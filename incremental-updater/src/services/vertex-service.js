const { GoogleAuth } = require('google-auth-library');

class VertexService {
  constructor(config) {
    try {
      // Handle config parsing with proper error handling
      if (!config) {
        console.warn('VertexService: No config provided, using default values');
        this.config = {
          PROJECT_ID: 'default-project',
          LOCATION: 'global',
          CATALOG_ID: 'default_catalog',
          BRANCH_ID: '0',
          KEY_FILE_PATH: undefined,
          CREDENTIALS: undefined
        };
      } else {
        this.config = typeof config === 'string' ? JSON.parse(config) : config;
      }

      // Validate required config properties
      if (!this.config.PROJECT_ID) {
        console.warn('VertexService: PROJECT_ID not provided, using default');
        this.config.PROJECT_ID = 'default-project';
      }

      // Initialize Google Auth
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

          console.log('🔧 VertexService: Using credentials from environment variables');
          this.auth = new GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else if (this.config.KEY_FILE_PATH) {
          // Fallback to key file (for backward compatibility)
          this.auth = new GoogleAuth({
            keyFilename: this.config.KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else {
          console.warn('VertexService: No credentials provided');
          this.auth = null;
        }
      } catch (error) {
        console.error('❌ VertexService: Failed to initialize Google Auth:', error.message);
        this.auth = null;
      }

      this.projectId = this.config.PROJECT_ID;
      this.location = this.config.LOCATION || 'global';
      this.catalogId = this.config.CATALOG_ID || 'default_catalog';
      this.branchId = this.config.BRANCH_ID || '0';
      
      // Build API paths
      this.projectPath = `projects/${this.projectId}`;
      this.catalogPath = `${this.projectPath}/locations/${this.location}/catalogs/${this.catalogId}`;
      this.branchPath = `${this.catalogPath}/branches/${this.branchId}`;
      
      // Retail API configuration
      this.retailApiBase = 'https://retail.googleapis.com';
      this.apiVersion = 'v2';
      
      // Alternative: Try the discovery API to find the correct endpoint
      this.discoveryApiBase = 'https://retail.googleapis.com/$discovery/rest';
      
          // VertexService initialized successfully
    } catch (error) {
      console.error('VertexService: Failed to initialize:', error.message);
      // Set default values to prevent crashes
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
    if (!this.auth) {
      throw new Error('Google Auth not initialized');
    }
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
  }

  getApiUrl(endpoint) {
    return `${this.retailApiBase}/${this.apiVersion}/${endpoint}`;
  }

  /**
   * Generate realistic random stock quantity
   */
  generateRandomStock() {
    const scenario = Math.random();
    
    if (scenario < 0.1) {
      return Math.floor(Math.random() * 6);
    } else if (scenario < 0.3) {
      return Math.floor(Math.random() * 20) + 6;
    } else if (scenario < 0.6) {
      return Math.floor(Math.random() * 75) + 26;
    } else if (scenario < 0.85) {
      return Math.floor(Math.random() * 400) + 101;
    } else {
      return Math.floor(Math.random() * 1500) + 501;
    }
  }

  async upsertProduct(productData) {
    try {
      // Upserting product to Vertex AI
      
      // Transform commercetools product data to Vertex AI Retail format
      const vertexProduct = this.transformToRetailProduct(productData);
      
      // Check if Vertex AI client is available
      if (!this.auth) {
        console.warn('VertexService: Google Auth not available, using mock implementation');
        return await this.performVertexUpsert(vertexProduct);
      }
      
      // Import product to Vertex AI
      const result = await this.importProduct(vertexProduct);
      
              // Successfully upserted product
      return result;
    } catch (error) {
      console.error(`Failed to upsert product ${productData.id}:`, error);
      throw error;
    }
  }

  async deleteProduct(productId) {
    try {
      // Deleting product from Vertex AI
      
      // Check if Vertex AI client is available
      if (!this.auth) {
        console.warn('VertexService: Google Auth not available, using mock implementation');
        return await this.performVertexDelete(productId);
      }
      
      // Delete product from Vertex AI
      const result = await this.deleteProductFromVertex(productId);
      
              // Successfully deleted product
      return result;
    } catch (error) {
      console.error(`Failed to delete product ${productId}:`, error);
      throw error;
    }
  }

  async batchUpsertProducts(productsData) {
    try {
      // Batch upserting products to Vertex AI
      
      const vertexProducts = productsData.map(product => this.transformToRetailProduct(product));
      
      // Check if Vertex AI client is available
      if (!this.auth) {
        console.warn('VertexService: Google Auth not available, using mock implementation');
        return await this.performBatchVertexUpsert(vertexProducts);
      }
      
      // Import products in batches
      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < vertexProducts.length; i += batchSize) {
        batches.push(vertexProducts.slice(i, i + batchSize));
      }

      const results = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        // Processing batch
        
        try {
          const result = await this.importProducts(batch);
          results.push(result);
          
          // Add delay between batches to avoid rate limiting
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to process batch ${i + 1}:`, error);
          results.push({ error: error.message, batchIndex: i });
        }
      }
      
              // Successfully batch upserted products
      return {
        success: true,
        processedCount: productsData.length,
        batchResults: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to batch upsert products:', error);
      throw error;
    }
  }

  transformToRetailProduct(productData) {
    const productId = productData.id || productData.key || '';
    
    // Extract product name from Commercetools structure (localized object)
    const productName = productData.masterData?.current?.name?.['en-US'] || 
                       productData.masterData?.current?.name?.['en-GB'] || 
                       productData.masterData?.current?.name?.['en'] || 
                       productData.name || 
                       productData.title || 
                       'No name';

    // Extract description from Commercetools structure (localized object)
    const productDescription = productData.masterData?.current?.description?.['en-US'] || 
                             productData.masterData?.current?.description?.['en-GB'] || 
                             productData.masterData?.current?.description?.['en'] || 
                             productData.description || 
                             productData.metaDescription || 
                             '';

    // Get the primary variant for SKU and other details
    // First check masterVariant (which contains the main product variant)
    // Then fallback to variants array if masterVariant doesn't exist
    const primaryVariant = productData.masterData?.current?.masterVariant || 
                          productData.masterData?.current?.variants?.[0] || 
                          productData.variants?.[0];
    const sku = primaryVariant?.sku || productId || 'NO-SKU';

    // Extract actual pricing from Commercetools
    const pricingInfo = this.extractPricingFromCommercetools(primaryVariant);
    
    // Extract actual stock quantity from Commercetools
    const stockQuantity = this.extractStockFromCommercetools(primaryVariant);
    
    // Generate rating (this can remain random as it's not typically stored in Commercetools)
    const ratingInfo = this.generateRating();

    // Build categories array - ensure we always have at least one category
    const categories = [];
    if (productData.masterData?.current?.categories && productData.masterData.current.categories.length > 0) {
      // Use category IDs from Commercetools
      productData.masterData.current.categories.forEach(cat => {
        if (cat.id) categories.push(cat.id);
      });
    } else if (productData.categories && productData.categories.length > 0) {
      // Fallback to name-based categories
      productData.categories.forEach(cat => {
        if (cat.name) categories.push(cat.name);
      });
    }
    
    // If no categories found, use a default category
    if (categories.length === 0) {
      categories.push('General');
    }

    // Build custom attributes - only include non-empty values
    const attributes = {
      sku: {
        text: [productId],
        searchable: true,
        indexable: true
      },
      totalStock: {
        numbers: [stockQuantity],
        searchable: false,
        indexable: true
      }
    };

    // Only add discount attributes if pricing information exists and has discount
    if (pricingInfo && pricingInfo.originalPrice) {
      attributes.hasDiscount = {
        text: ['true'],
        searchable: true,
        indexable: true
      };
      
      attributes.discountPercent = {
        numbers: [Math.round(((pricingInfo.originalPrice - pricingInfo.price) / pricingInfo.originalPrice) * 100)],
        searchable: false,
        indexable: true
      };
    } else if (pricingInfo) {
      attributes.hasDiscount = {
        text: ['false'],
        searchable: true,
        indexable: true
      };
    }

    // Only add brand if it exists and is not empty
    if (productData.brand && productData.brand.trim() !== '') {
      attributes.brand = {
        text: [productData.brand],
        searchable: true,
        indexable: true
      };
    }

    // Only add vendor if it exists and is not empty
    if (productData.vendor && productData.vendor.trim() !== '') {
      attributes.vendor = {
        text: [productData.vendor],
        searchable: true,
        indexable: true
      };
    }

    // Build search keywords - filter out empty strings
    const searchKeywords = [
      productId,
      productData.name,
      productData.description,
      productData.brand,
      ...categories
    ].filter(keyword => keyword && keyword.trim() !== '');

    if (searchKeywords.length > 0) {
      attributes.searchKeywords = {
        text: searchKeywords,
        searchable: true,
        indexable: true
      };
    }

    // Add variant information if available
    if (primaryVariant) {
      if (primaryVariant.sku && primaryVariant.sku.trim() !== '') {
        attributes.sku.text[0] = primaryVariant.sku;
      }
      
      if (primaryVariant.attributes) {
        primaryVariant.attributes.forEach(attr => {
          if (attr.name && attr.value && attr.value.toString().trim() !== '') {
            attributes[`attr_${attr.name}`] = {
              text: [attr.value.toString()],
              searchable: true,
              indexable: true
            };
          }
        });
      }
    }

    const product = {
      id: productId,
      type: 'PRIMARY',
      categories,
      title: productName,
      description: productDescription,
      languageCode: 'en',
      attributes,
      tags: [
        ...(productData.brand ? [productData.brand] : []),
        ...categories,
        ...(pricingInfo?.originalPrice ? ['On Sale'] : []),
        stockQuantity > 0 ? 'in stock' : 'out of stock'
      ],
      availability: stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      availableQuantity: stockQuantity,
      uri: `/product/${productId}`,
      images: primaryVariant?.images?.map(img => ({
        uri: img.url,
        height: img.dimensions?.h || 300,
        width: img.dimensions?.w || 300
      })) || productData.images?.map(img => ({
        uri: typeof img === 'string' ? img : img.url || img.uri,
        height: img.dimensions?.h || img.height || 300,
        width: img.dimensions?.w || img.width || 300
      })) || [],
      publishTime: new Date().toISOString(),
      rating: ratingInfo
    };

    // Only add priceInfo if pricing information exists
    if (pricingInfo) {
      product.priceInfo = pricingInfo;
    }

    return product;
  }

  extractPricingFromCommercetools(variant) {
    // Check if variant has pricing information
    if (variant?.prices && variant.prices.length > 0) {
      const price = variant.prices[0];
      
      // Extract price value (convert from centAmount to dollars)
      const priceValue = price.value?.centAmount ? price.value.centAmount / 100 : 0;
      const currencyCode = price.value?.currencyCode || 'USD';
      
      // Check for discounted price
      if (price.discounted) {
        const discountedValue = price.discounted.value?.centAmount ? price.discounted.value.centAmount / 100 : 0;
        
        return {
          price: discountedValue,
          originalPrice: priceValue,
          currencyCode: currencyCode
        };
      } else {
        return {
          price: priceValue,
          currencyCode: currencyCode
        };
      }
    }
    
    // If no pricing information, return null to indicate no price
    return null;
  }

  extractStockFromCommercetools(variant) {
    // Check if variant has availability information
    if (variant?.availability?.availableQuantity !== undefined) {
      return variant.availability.availableQuantity;
    }
    
    // Check for custom attributes that might contain stock information
    if (variant?.attributes) {
      const stockAttr = variant.attributes.find(attr => 
        attr.name === 'stock' || 
        attr.name === 'quantity' || 
        attr.name === 'availableQuantity'
      );
      
      if (stockAttr && stockAttr.value) {
        return parseInt(stockAttr.value) || 0;
      }
    }
    
    // If no stock information found, return 0
    return 0;
  }

  generateRating() {
    const averageRating = Math.round((Math.random() * 2 + 3) * 10) / 10;
    const ratingCount = Math.floor(Math.random() * 495 + 5);
    
    return {
      averageRating,
      ratingCount
    };
  }

  async importProduct(product) {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = `${this.branchPath}/products:import`;
      const url = this.getApiUrl(endpoint);

      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products: [product]
          }
        },
        reconciliationMode: 'INCREMENTAL'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Product import failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const operation = await response.json();
      // Import operation started
      
      // Poll the operation to check for completion and errors
      const operationResult = await this.pollOperation(operation.name, accessToken);
      
      if (!operationResult.success) {
        throw new Error(`Import operation failed: ${operationResult.error}`);
      }
      
      return {
        success: true,
        productId: product.id,
        operation: operation.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Product import error:', error);
      throw error;
    }
  }

  async pollOperation(operationName, accessToken) {
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
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

  async importProducts(products) {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = `${this.branchPath}/products:import`;
      const url = this.getApiUrl(endpoint);

      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products
          }
        },
        reconciliationMode: 'INCREMENTAL'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Product import failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const operation = await response.json();
      // Batch import operation started
      
      // Poll the operation to check for completion and errors
      const operationResult = await this.pollOperation(operation.name, accessToken);
      
      if (!operationResult.success) {
        throw new Error(`Batch import operation failed: ${operationResult.error}`);
      }
      
      return {
        success: true,
        processedCount: products.length,
        operation: operation.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Batch product import error:', error);
      throw error;
    }
  }

  async deleteProductFromVertex(productId) {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = `${this.branchPath}/products/${productId}`;
      const url = this.getApiUrl(endpoint);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Product delete failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return {
        success: true,
        productId: productId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Product delete error:', error);
      throw error;
    }
  }

  async createCatalog() {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = `${this.projectPath}/locations/${this.location}/catalogs`;
      const url = this.getApiUrl(endpoint);

      const catalogRequest = {
        catalogId: this.catalogId,
        displayName: 'Commercetools Product Catalog',
        productLevelConfig: {
          ingestionProductType: 'PRIMARY',
          merchantCenterProductIdField: 'id'
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(catalogRequest),
      });

      if (response.status === 409) {
        // Catalog already exists
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catalog creation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const catalog = await response.json();
      // Catalog created successfully
    } catch (error) {
      console.error('❌ Catalog creation error:', error);
      throw error;
    }
  }

  // Mock implementations for fallback
  async performVertexUpsert(vertexData) {
    // Performing mock Vertex AI upsert
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      success: true,
      productId: vertexData.id,
      timestamp: new Date().toISOString()
    };
  }

  async performVertexDelete(productId) {
    // Performing mock Vertex AI delete
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      success: true,
      productId: productId,
      timestamp: new Date().toISOString()
    };
  }

  async performBatchVertexUpsert(vertexDataArray) {
    // Performing mock batch Vertex AI upsert
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      processedCount: vertexDataArray.length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { VertexService }; 