class ProductSyncService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
  }

  async syncProduct(productId, action = 'upsert') {
    try {
      console.log(`🔄 ProductSyncService.syncProduct called with: productId=${productId}, action=${action}`);
      
      if (action === 'delete') {
        console.log(`🗑️ Calling VertexService.deleteProduct for product: ${productId}`);
        const result = await this.vertexService.deleteProduct(productId);
        console.log(`✅ VertexService.deleteProduct completed for product: ${productId}`, result);
        return result;
      } else {
        console.log(`📦 Fetching product data for: ${productId}`);
        const product = await this.fetchProductById(productId);
        console.log(`📦 Product data fetched, calling VertexService.upsertProduct for: ${productId}`);
        const result = await this.vertexService.upsertProduct(product);
        console.log(`✅ VertexService.upsertProduct completed for product: ${productId}`, result);
        return result;
      }
    } catch (error) {
      console.error(`❌ Failed to sync product ${productId}:`, error);
      console.error(`🔍 Error details:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async syncProductWithStoreCheck(productId, storeKey, action = 'upsert') {
    try {
      // Syncing product with action
      
      if (action === 'delete') {
        return await this.vertexService.deleteProduct(productId);
      } else {
        // Fetch product from general product projections
        const product = await this.fetchProductProjectionInStore(productId, storeKey);
        
        if (product) {
          return await this.vertexService.upsertProduct(product);
        } else {
          // Product not found, remove it from Vertex
          console.log(`Product ${productId} not found, removing from Vertex`);
          return await this.vertexService.deleteProduct(productId);
        }
      }
    } catch (error) {
      console.error(`Failed to sync product ${productId}:`, error);
      throw error;
    }
  }

  async syncStoreProducts(storeKey) {
    try {
      // Syncing all products for store
      
      const products = await this.fetchProductsByStore(storeKey);
      // Found products for store
      
      const results = [];
      for (const product of products) {
        try {
          const result = await this.vertexService.upsertProduct(product);
          results.push(result);
        } catch (error) {
          console.error(`Failed to sync product ${product.id}:`, error);
          results.push({ error: error.message, productId: product.id });
        }
      }
      
      return {
        success: true,
        processedCount: products.length,
        results
      };
    } catch (error) {
      console.error(`Failed to sync store products for ${storeKey}:`, error);
      throw error;
    }
  }

  async fetchProductById(productId) {
    try {
      const response = await this.commercetoolsClient
        .execute({
          uri: `/products/${productId}`,
          method: 'GET'
        });

      return response.body;
    } catch (error) {
      console.error(`Failed to fetch product ${productId}:`, error);
      throw error;
    }
  }

  async fetchProductProjectionInStore(productId, storeKey) {
    try {
      // Use direct HTTP request instead of SDK to avoid authentication issues
      const https = require('https');
      
      // First get access token
      const accessToken = await this.getAccessToken();
      
      // Then fetch product
      const response = await this.fetchProductWithToken(accessToken, productId);
      return response;
    } catch (error) {
      if (error.statusCode === 404) {
        // Product not found
        return null;
      }
      console.error(`Failed to fetch product projection ${productId}:`, error);
      throw error;
    }
  }

  async getAccessToken() {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const postData = `grant_type=client_credentials&scope=manage_project:${process.env.CTP_PROJECT_KEY}`;
      
      const options = {
        hostname: 'auth.us-central1.gcp.commercetools.com',
        port: 443,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(process.env.CTP_CLIENT_ID + ':' + process.env.CTP_CLIENT_SECRET).toString('base64')
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            const tokenData = JSON.parse(data);
            resolve(tokenData.access_token);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async fetchProductWithToken(accessToken, productId) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      
      const options = {
        hostname: 'api.us-central1.gcp.commercetools.com',
        port: 443,
        path: `/${process.env.CTP_PROJECT_KEY}/products/${productId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            const product = JSON.parse(data);
            resolve(product);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  async fetchProductsByStore(storeKey) {
    try {
      // Fetching products for store
      
      // First, get the store to find its product selections
      const storeResponse = await this.commercetoolsClient
        .execute({
          uri: `/stores/key=${storeKey}`,
          method: 'GET'
        });

      const store = storeResponse.body;
      const productSelections = store.productSelections || [];

      const allProducts = [];

      for (const productSelection of productSelections) {
        const products = await this.fetchProductsByProductSelection(productSelection.id);
        allProducts.push(...products);
      }

              // Found products for store
      return allProducts;

    } catch (error) {
      console.error(`Failed to fetch products for store ${storeKey}:`, error);
      throw error;
    }
  }

  async fetchProductsByProductSelection(productSelectionId) {
    try {
      const products = [];
      let lastId = null;
      const limit = 500;

      while (true) {
        const query = {
          limit,
          ...(lastId && { where: `id > "${lastId}"` })
        };

        const response = await this.commercetoolsClient
          .execute({
            uri: `/product-selections/${productSelectionId}/products`,
            method: 'GET',
            query
          });

        const batch = response.body.results;
        products.push(...batch);

        if (batch.length < limit) {
          break;
        }

        lastId = batch[batch.length - 1].id;
      }

      return products;

    } catch (error) {
      console.error(`Failed to fetch products for product selection ${productSelectionId}:`, error);
      throw error;
    }
  }

  async handleProductSelectionChange(productSelectionId, storeKey) {
    try {
      // Handling product selection change
      
      // Get all products in the product selection
      const products = await this.fetchProductsByProductSelection(productSelectionId);
      
      // Sync each product with store check
      const results = [];
      for (const product of products) {
        try {
          const result = await this.syncProductWithStoreCheck(product.id, storeKey, 'upsert');
          results.push(result);
        } catch (error) {
          console.error(`Failed to sync product ${product.id}:`, error);
          results.push({ error: error.message, productId: product.id });
        }
      }
      
      return {
        success: true,
        productSelectionId,
        storeKey,
        processedCount: products.length,
        results
      };
    } catch (error) {
      console.error(`Failed to handle product selection change:`, error);
      throw error;
    }
  }
}

module.exports = { ProductSyncService }; 