const { GoogleAuth } = require('google-auth-library');

/**
 * VertexService - Handles communication with Google Cloud Vertex AI Retail API
 */
class VertexService {
  constructor(config) {
    try {
      // Parse config with proper error handling
      if (!config) {
        console.warn('⚠️ VertexService: No config provided, using default values');
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

      // Validate required config properties
      if (!this.config.PROJECT_ID) {
        console.warn('⚠️ VertexService: PROJECT_ID not provided, using default');
        this.config.PROJECT_ID = 'default-project';
      }

      // Initialize Google Auth with error handling
      try {
        if (this.config.CREDENTIALS) {
          // Use credentials from config (environment variables)
          this.auth = new GoogleAuth({
            credentials: this.config.CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else if (this.config.KEY_FILE_PATH) {
          // Fallback to key file (for backward compatibility)
          this.auth = new GoogleAuth({
            keyFile: this.config.KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
        } else {
          console.warn('⚠️ VertexService: No credentials provided');
          this.auth = null;
        }
      } catch (authError) {
        console.warn('⚠️ VertexService: Failed to initialize Google Auth:', authError.message);
        this.auth = null;
      }

      // Vertex AI Retail API configuration
      this.projectId = this.config.PROJECT_ID;
      this.location = this.config.LOCATION || 'global';
      this.catalogId = this.config.CATALOG_ID || 'default_catalog';
      this.branchId = this.config.BRANCH_ID || '0';
      
      console.log('✅ VertexService initialized with config:', {
        projectId: this.projectId,
        location: this.location,
        catalogId: this.catalogId,
        branchId: this.branchId
      });
    } catch (error) {
      console.error('❌ VertexService: Failed to initialize:', error.message);
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
    // Extract product name from localized object
    const productName = commercetoolsProduct.masterData?.current?.name?.['en-US'] || 
                       commercetoolsProduct.masterData?.current?.name?.['en-GB'] || 
                       commercetoolsProduct.masterData?.current?.name?.['en'] || 
                       'No name';

    // Extract description from localized object
    const productDescription = commercetoolsProduct.masterData?.current?.description?.['en-US'] || 
                             commercetoolsProduct.masterData?.current?.description?.['en-GB'] || 
                             commercetoolsProduct.masterData?.current?.description?.['en'] || 
                             '';

    // Get the first variant for SKU and other details
    const variant = commercetoolsProduct.masterData?.current?.variants?.[0];
    const sku = variant?.sku || commercetoolsProduct.id || 'NO-SKU';

    // Transform to Vertex AI Retail API format
    const product = {
      id: commercetoolsProduct.id,
      title: productName,
      description: productDescription,
      categories: commercetoolsProduct.masterData?.current?.categories?.map(cat => cat.id) || [],
      fulfillmentInfo: [{
        type: 'pickup-in-store',
        placeIds: ['store1', 'store2']
      }],
      priceInfo: {
        price: variant?.prices?.[0]?.value?.centAmount ? 
               variant.prices[0].value.centAmount / 100 : 0,
        originalPrice: variant?.prices?.[0]?.value?.centAmount ? 
                      variant.prices[0].value.centAmount / 100 : 0,
        currencyCode: variant?.prices?.[0]?.value?.currencyCode || 'USD'
      },
      availableQuantity: variant?.availability?.availableQuantity || 0,
      uri: `https://example.com/products/${commercetoolsProduct.id}`,
      images: variant?.images?.map(img => ({
        uri: img.url,
        height: img.dimensions?.h || 0,
        width: img.dimensions?.w || 0
      })) || []
    };

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

    // Add product ID as a custom attribute
    customAttributes['product_id'] = {
      text: [commercetoolsProduct.id]
    };

    // Add CTP region information
    customAttributes['ctp_region'] = {
      text: [process.env.CTP_REGION || 'unknown']
    };

    if (Object.keys(customAttributes).length > 0) {
      product.attributes = customAttributes;
    }

    return product;
  }

  async importProduct(productData) {
    try {
      console.log(`Importing product ${productData.id} to Vertex AI`);
      
      const retailProduct = this.transformToRetailProduct(productData);
      
      // Use the same format as batch import for single product
      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products: [retailProduct]
          }
        }
      };
      
      const result = await this.makeVertexRequest('/products:import', 'POST', importRequest);
      
      console.log(`Successfully imported product ${productData.id}`);
      return result;
    } catch (error) {
      console.error(`Failed to import product ${productData.id}:`, error);
      throw error;
    }
  }

  async importProducts(productsData) {
    try {
      console.log(`Importing ${productsData.length} products to Vertex AI`);
      
      const retailProducts = productsData.map(product => this.transformToRetailProduct(product));
      
      // Vertex AI Retail API expects a message format for batch imports
      const importRequest = {
        inputConfig: {
          productInlineSource: {
            products: retailProducts
          }
        }
      };
      
      const result = await this.makeVertexRequest('/products:import', 'POST', importRequest);
      
      console.log(`Successfully imported ${productsData.length} products`);
      return result;
    } catch (error) {
      console.error('Failed to import products:', error);
      throw error;
    }
  }

  async deleteProductFromVertex(productId) {
    try {
      console.log(`Deleting product ${productId} from Vertex AI`);
      
      const result = await this.makeVertexRequest(`/products/${productId}`, 'DELETE');
      
      console.log(`Successfully deleted product ${productId}`);
      return result;
    } catch (error) {
      console.error(`Failed to delete product ${productId}:`, error);
      throw error;
    }
  }

  async createCatalog() {
    try {
      console.log('Creating catalog in Vertex AI');
      
      const result = await this.makeVertexRequest('', 'POST', {
        displayName: 'Commercetools Products Catalog',
        productLevelConfig: {
          ingestionProductType: 'primary'
        }
      });
      
      console.log('Successfully created catalog');
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
}

module.exports = { VertexService }; 