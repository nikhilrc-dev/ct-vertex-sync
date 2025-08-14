const { GoogleAuth } = require('google-auth-library');

/**
 * VertexService - Handles communication with Google Cloud Vertex AI Retail API
 */
class VertexService {
  constructor(config) {
    try {
      if (!config) {
        this.config = {
          PROJECT_ID: 'default-project',
          LOCATION: 'global',
          CATALOG_ID: 'default_catalog',
          BRANCH_ID: '0',
          KEY_FILE_PATH: undefined
        };
      } else {
        this.config = typeof config === 'string' ? JSON.parse(config) : config;
      }

      if (!this.config.PROJECT_ID) {
        this.config.PROJECT_ID = 'default-project';
      }

      // Initialize Google Auth with error handling
      try {
        if (this.config.CREDENTIALS) {
          // Use credentials from config (environment variables)
          // Fix private key formatting for environment variables
          const credentials = { ...this.config.CREDENTIALS };

          // Ensure private key is properly formatted
          if (credentials.private_key) {
            // Replace literal \n with actual newlines
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

            // Ensure the private key has proper headers and footers
            if (!credentials.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
              credentials.private_key = `-----BEGIN PRIVATE KEY-----\n${credentials.private_key}\n-----END PRIVATE KEY-----`;
            }
          }

          this.auth = new GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else if (this.config.KEY_FILE_PATH) {
          this.auth = new GoogleAuth({
            keyFile: this.config.KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else {
          this.auth = null;
        }
      } catch (authError) {
        this.auth = null;
      }

      this.projectId = this.config.PROJECT_ID;
      this.location = this.config.LOCATION || 'global';
      this.catalogId = this.config.CATALOG_ID || 'default_catalog';
      this.branchId = this.config.BRANCH_ID || '0';
    } catch (error) {
      this.config = {
        PROJECT_ID: 'default-project',
        LOCATION: 'global',
        CATALOG_ID: 'default_catalog',
        BRANCH_ID: '0'
      };
      this.auth = null;
      this.projectId = 'default-project';
      this.location = 'global';
      this.catalogId = 'default_catalog';
      this.branchId = '0';
    }
  }

  async getAccessToken() {
    try {
      if (!this.auth) {
        throw new Error('Google Auth not initialized - check your configuration');
      }
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      return accessToken.token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  async makeVertexRequest(endpoint, method = 'GET', body = null) {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://retail.googleapis.com/v2/projects/${this.projectId}/locations/${this.location}/catalogs/${this.catalogId}/branches/${this.branchId}${endpoint}`;
      
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Vertex AI request failed:', error);
      throw error;
    }
  }

  transformToRetailProduct(commercetoolsProduct) {
    // Extract product name from GraphQL format (already localized)
    const productName = commercetoolsProduct.masterData?.current?.name || 
                       commercetoolsProduct.title || 
                       commercetoolsProduct.name || 
                       'No name';

    // Extract description from GraphQL format (already localized)
    const productDescription = commercetoolsProduct.masterData?.current?.description || '';

    // Get the master variant for SKU and other details (GraphQL format)
    const variant = commercetoolsProduct.masterData?.current?.masterVariant || 
                   commercetoolsProduct.masterData?.current?.variants?.[0];
    const sku = variant?.sku || commercetoolsProduct.id || 'NO-SKU';

    // Extract pricing information with proper discount handling
    const pricingInfo = this.extractPricingFromCommercetools(variant);
    
    // Extract availability information from the entire product
    const availabilityInfo = this.extractAvailabilityFromCommercetools(commercetoolsProduct);

    // Transform to Vertex AI Retail API format
    const product = {
      id: commercetoolsProduct.id,
      title: productName,
      description: productDescription,
      categories: commercetoolsProduct.masterData?.current?.categories?.map(cat => cat.name) || [],
      availableQuantity: availabilityInfo.availableQuantity,
      availability: availabilityInfo.availableQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      uri: this.buildProductUri(commercetoolsProduct),
      images: variant?.images?.map(img => ({
        uri: img.url,
        height: img.dimensions?.h || 0,
        width: img.dimensions?.w || 0
      })) || []
    };



    // Add priceInfo only if pricing information exists
    if (pricingInfo) {
      product.priceInfo = {
        currencyCode: pricingInfo.currencyCode,
        price: pricingInfo.price,
        originalPrice: pricingInfo.originalPrice || pricingInfo.price
      };
    }

    // Add custom attributes in the correct format
    const customAttributes = {};
    if (variant?.attributes) {
      variant.attributes.forEach(attr => {
        if (attr.value) {
          customAttributes[attr.name] = {
            text: [attr.value.toString()]
          };
        }
      });
    }

    // Add SKU as a custom attribute (always include it)
    customAttributes['sku'] = {
      text: [sku]
    };

    // Add product type as a custom attribute (using name instead of ID)
    if (commercetoolsProduct.productType) {
      customAttributes['product_type'] = {
        text: [commercetoolsProduct.productType]
      };
    }

    // Add CTP region information
    customAttributes['ctp_region'] = {
      text: [process.env.CTP_REGION || 'unknown']
    };

    // Always add attributes to the product
    product.attributes = customAttributes;

    return product;
  }

  /**
   * Extract pricing information from commercetools variant
   */
  extractPricingFromCommercetools(variant) {
    if (!variant?.prices || variant.prices.length === 0) {
      return null;
    }

    const price = variant.prices[0];
    const basePrice = price.value?.centAmount ? price.value.centAmount / 100 : 0;
    const currencyCode = price.value?.currencyCode || 'USD';

    // Check for discounted price
    if (price.discounted && price.discounted.value?.centAmount) {
      const salePrice = price.discounted.value.centAmount / 100;
      
      return {
        price: salePrice,
        originalPrice: basePrice,
        currencyCode: currencyCode
      };
    } else {
      return {
        price: basePrice,
        currencyCode: currencyCode
      };
    }
  }

  /**
   * Extract availability information from commercetools product (masterVariant + variants)
   */
  extractAvailabilityFromCommercetools(productData) {
    // First check masterVariant availability (highest priority)
    const masterVariant = productData.masterData?.current?.masterVariant;
    if (masterVariant) {
      // Check direct availability data from commercetools (REST API format)
      if (masterVariant.availability?.availableQuantity !== undefined) {
        const stockValue = masterVariant.availability.availableQuantity || 0;
        return {
          availableQuantity: stockValue,
          isAvailable: stockValue > 0
        };
      }
      
      // Check custom attributes for stock information
      if (masterVariant.attributes) {
        const stockAttr = masterVariant.attributes.find(attr => 
          attr.name === 'stock' || 
          attr.name === 'quantity' || 
          attr.name === 'availableQuantity' ||
          attr.name === 'inventory' ||
          attr.name === 'stockLevel' ||
          attr.name === 'qty' ||
          attr.name === 'qtyAvailable'
        );
        
        if (stockAttr && stockAttr.value) {
          const stockValue = parseInt(stockAttr.value) || 0;
          return {
            availableQuantity: stockValue,
            isAvailable: stockValue > 0
          };
        }
      }
    }

    // Then check all variants for availability
    const variants = productData.masterData?.current?.variants || [];
    for (const variant of variants) {
      // Check direct availability data from commercetools (REST API format)
      if (variant.availability?.availableQuantity !== undefined) {
        const stockValue = variant.availability.availableQuantity || 0;
        return {
          availableQuantity: stockValue,
          isAvailable: stockValue > 0
        };
      }
      
      // Check custom attributes for stock information
      if (variant.attributes) {
        const stockAttr = variant.attributes.find(attr => 
          attr.name === 'stock' || 
          attr.name === 'quantity' || 
          attr.name === 'availableQuantity' ||
          attr.name === 'inventory' ||
          attr.name === 'stockLevel' ||
          attr.name === 'qty' ||
          attr.name === 'qtyAvailable'
        );
        
        if (stockAttr && stockAttr.value) {
          const stockValue = parseInt(stockAttr.value) || 0;
          return {
            availableQuantity: stockValue,
            isAvailable: stockValue > 0
          };
        }
      }
    }

    // Default to 0 quantity if no stock information found
    return { availableQuantity: 0, isAvailable: false };
  }



  /**
   * Build product URI based on product data
   */
  buildProductUri(commercetoolsProduct) {
    // Use environment variable for base URL if available
    const baseUrl = process.env.PRODUCT_BASE_URL || 'https://your-store.com';
    
    // Get the SKU from the master variant
    const variant = commercetoolsProduct.masterData?.current?.masterVariant || 
                   commercetoolsProduct.masterData?.current?.variants?.[0];
    const sku = variant?.sku || commercetoolsProduct.key || commercetoolsProduct.id;
    
    return `${baseUrl}/products/${sku}`;
  }

  async importProduct(productData) {
    try {
      const retailProduct = this.transformToRetailProduct(productData);
      
      // Use the same format as batch import for single product
      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products: [retailProduct]
          }
        },
        reconciliationMode: 'INCREMENTAL'
      };
      
      const operation = await this.makeVertexRequest('/products:import', 'POST', importRequest);
      
      // Poll the operation to check for completion and errors
      const operationResult = await this.pollOperation(operation.name);
      
      if (!operationResult.success) {
        throw new Error(`Import operation failed: ${operationResult.error}`);
      }
      
      return {
        success: true,
        operation: operation.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to import product ${productData.id}:`, error);
      throw error;
    }
  }

  async importProducts(productsData) {
    try {
      console.log(`🔄 Full Sync: Importing ${productsData.length} products to Vertex AI`);
      
      const retailProducts = productsData.map(product => this.transformToRetailProduct(product));
      
      // Log the complete Vertex AI payload for full sync
      if (retailProducts.length > 0) {
        console.log('📋 VERTEX AI FULL SYNC PAYLOAD:');
        console.log('Total Products:', retailProducts.length);
        console.log('Sample Product:', {
          id: retailProducts[0].id,
          title: retailProducts[0].title,
          categories: retailProducts[0].categories,
          availableQuantity: retailProducts[0].availableQuantity,
          availability: retailProducts[0].availability,
          priceInfo: retailProducts[0].priceInfo,
          attributes: retailProducts[0].attributes
        });
        console.log('--- COMPLETE VERTEX AI PAYLOAD ---');
        console.log(JSON.stringify(retailProducts, null, 2));
        console.log('--- END VERTEX AI PAYLOAD ---');
      }
      
      // Vertex AI Retail API expects a message format for batch imports
      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products: retailProducts
          }
        },
        reconciliationMode: 'INCREMENTAL'
      };
      
      const operation = await this.makeVertexRequest('/products:import', 'POST', importRequest);
      
      // Poll the operation to check for completion and errors
      const operationResult = await this.pollOperation(operation.name);
      
      if (!operationResult.success) {
        throw new Error(`Import operation failed: ${operationResult.error}`);
      }
      
      console.log(`✅ Full Sync: Successfully imported ${productsData.length} products to Vertex AI`);
      return {
        success: true,
        operation: operation.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Full Sync: Failed to import products to Vertex AI:', error);
      throw error;
    }
  }

  async deleteProductFromVertex(productId) {
    try {
      const result = await this.makeVertexRequest(`/products/${productId}`, 'DELETE');
      return result;
    } catch (error) {
      console.error(`Failed to delete product ${productId}:`, error);
      throw error;
    }
  }

  async createCatalog() {
    try {
      const result = await this.makeVertexRequest('', 'POST', {
        displayName: 'Commercetools Products Catalog',
        productLevelConfig: {
          ingestionProductType: 'primary'
        }
      });
      
      return result;
    } catch (error) {
      console.error('Failed to create catalog:', error);
      throw error;
    }
  }

  async upsertProduct(productData) {
    return await this.importProduct(productData);
  }

  async deleteProduct(productId) {
    return await this.deleteProductFromVertex(productId);
  }

  async batchUpsertProducts(productsData) {
    return await this.importProducts(productsData);
  }

  async pollOperation(operationName) {
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const accessToken = await this.getAccessToken();
        const response = await fetch(`https://retail.googleapis.com/v2/${operationName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to check operation status: ${response.status} ${response.statusText}`);
        }

        const operation = await response.json();
        
        if (operation.done) {
          // Check for errors in the operation
          if (operation.error) {
            return {
              success: false,
              error: `Operation failed: ${operation.error.message || JSON.stringify(operation.error)}`
            };
          }
          
          // Check for import errors in the response
          if (operation.response && operation.response.errorSamples && operation.response.errorSamples.length > 0) {
            const errorDetails = operation.response.errorSamples.map(err => 
              `${err.code}: ${err.message}`
            ).join('; ');
            
            return {
              success: false,
              error: `Import errors: ${errorDetails}`
            };
          }
          
          // Check failure count in metadata
          if (operation.metadata && operation.metadata.failureCount && parseInt(operation.metadata.failureCount) > 0) {
            return {
              success: false,
              error: `Import failed with ${operation.metadata.failureCount} failures`
            };
          }
          
          return { success: true };
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
        attempts++;
        
      } catch (error) {
        console.error('Error polling operation:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    return {
      success: false,
      error: 'Operation timed out after 5 minutes'
    };
  }
}

module.exports = { VertexService }; 