class ProductExportService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
  }

  async performFullSync() {
    try {
      // Starting full sync process
      
      const startTime = Date.now();
      let processedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Fetch all products from commercetools
      const products = await this.fetchAllProducts();
              // Found products to sync

      // Process products in batches to avoid overwhelming the system
      const batchSize = 50;
      const batches = this.chunkArray(products, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
                  // Processing batch

        try {
          const batchResult = await this.vertexService.batchUpsertProducts(batch);
          processedCount += batch.length;
                      // Successfully processed batch
        } catch (error) {
          console.error(`Error processing batch ${i + 1}:`, error);
          errorCount += batch.length;
          errors.push({
            batchIndex: i,
            error: error.message,
            products: batch.map(p => p.id)
          });
        }

        // Add a small delay between batches to be respectful to the APIs
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        success: true,
        totalProducts: products.length,
        processedCount,
        errorCount,
        duration: `${duration}ms`,
        errors: errors.length > 0 ? errors : undefined
      };

              // Full sync completed
      return result;

    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  async fetchAllProducts() {
    try {
      // Fetching all products from commercetools
      
      // Use direct HTTP request instead of SDK to avoid authentication issues
      const https = require('https');
      
      // First get access token
      const accessToken = await this.getAccessToken();
      
      const products = [];
      let lastId = null;
      const limit = 500; // commercetools API limit

      while (true) {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          ...(lastId && { where: `id > "${lastId}"` })
        });

        const response = await this.fetchWithToken(accessToken, `/products?${queryParams}`);
        const batch = response.results;
        products.push(...batch);

                  // Fetched products

        // Check if we've reached the end
        if (batch.length < limit) {
          break;
        }

        lastId = batch[batch.length - 1].id;
      }

              // Total products fetched
      return products;

    } catch (error) {
      console.error('Failed to fetch products from commercetools:', error);
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

  async fetchWithToken(accessToken, endpoint) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      
      const options = {
        hostname: 'api.us-central1.gcp.commercetools.com',
        port: 443,
        path: `/${process.env.CTP_PROJECT_KEY}${endpoint}`,
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
            const result = JSON.parse(data);
            resolve(result);
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

  async fetchProductById(productId) {
    try {
      // Use direct HTTP request instead of SDK to avoid authentication issues
      const accessToken = await this.getAccessToken();
      const response = await this.fetchWithToken(accessToken, `/products/${productId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch product ${productId}:`, error);
      throw error;
    }
  }

  async fetchProductsByStore(storeKey) {
    try {
              // Fetching products for store
      
      // Use direct HTTP request instead of SDK to avoid authentication issues
      const accessToken = await this.getAccessToken();
      
      // First, get the store to find its product selections
      const store = await this.fetchWithToken(accessToken, `/stores/key=${storeKey}`);
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
      // Use direct HTTP request instead of SDK to avoid authentication issues
      const accessToken = await this.getAccessToken();
      
      const products = [];
      let lastId = null;
      const limit = 500;

      while (true) {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          ...(lastId && { where: `id > "${lastId}"` })
        });

        const response = await this.fetchWithToken(accessToken, `/product-selections/${productSelectionId}/products?${queryParams}`);
        const batch = response.results;
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

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async syncProduct(productId, action = 'upsert') {
    try {
      if (action === 'delete') {
        return await this.vertexService.deleteProduct(productId);
      } else {
        const product = await this.fetchProductById(productId);
        return await this.vertexService.upsertProduct(product);
      }
    } catch (error) {
      console.error(`Failed to sync product ${productId}:`, error);
      throw error;
    }
  }
}

module.exports = { ProductExportService }; 