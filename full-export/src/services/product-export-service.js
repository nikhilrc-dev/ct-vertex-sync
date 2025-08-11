/**
 * ProductExportService - Handles full synchronization of products from commercetools to Vertex AI
 */
class ProductExportService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
  }

  /**
   * Performs a full synchronization of all products from commercetools to Vertex AI
   * @returns {Object} Sync result with counts and timing information
   */
  async performFullSync() {
    try {
      console.log('🚀 Starting full product synchronization...');
      
      const startTime = Date.now();
      let processedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Fetch all products from commercetools
      const products = await this.fetchAllProducts();
      console.log(`📦 Found ${products.length} products to sync`);

      // Process products in batches to avoid overwhelming the APIs
      const batchSize = 50;
      const batches = this.chunkArray(products, batchSize);
      console.log(`🔄 Processing ${batches.length} batches of ${batchSize} products each`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📤 Processing batch ${i + 1}/${batches.length} (${batch.length} products)`);

        try {
          const batchResult = await this.vertexService.batchUpsertProducts(batch);
          processedCount += batch.length;
          console.log(`✅ Successfully processed batch ${i + 1}`);
        } catch (error) {
          console.error(`❌ Error processing batch ${i + 1}:`, error.message);
          errorCount += batch.length;
          errors.push({
            batchIndex: i,
            error: error.message,
            products: batch.map(p => p.id)
          });
        }

        // Add delay between batches to be respectful to the APIs
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

      console.log(`🎉 Full sync completed in ${duration}ms`);
      return result;

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetches all products from commercetools using pagination
   * @returns {Array} Array of all products
   */
  async fetchAllProducts() {
    try {
      console.log('📥 Fetching all products from commercetools...');
      
      const accessToken = await this.getAccessToken();
      const products = [];
      let offset = 0;
      const limit = 500; // commercetools API limit

      while (true) {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString()
        });

        const response = await this.fetchWithToken(accessToken, `/products?${queryParams}`);
        const batch = response.results;
        
        if (batch.length === 0) {
          break;
        }
        
        products.push(...batch);
        console.log(`📦 Fetched ${batch.length} products (offset: ${offset}, total: ${products.length})`);

        // Check if we've reached the end
        if (batch.length < limit) {
          break;
        }

        offset += limit;
      }

      console.log(`✅ Total products fetched: ${products.length}`);
      return products;

    } catch (error) {
      console.error('❌ Failed to fetch products from commercetools:', error);
      throw error;
    }
  }

  /**
   * Gets an access token from commercetools OAuth endpoint
   * @returns {Promise<string>} Access token
   */
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

  /**
   * Makes an authenticated HTTP request to commercetools API
   * @param {string} accessToken - OAuth access token
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<Object>} API response
   */
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

  /**
   * Fetches a single product by ID
   * @param {string} productId - Product ID to fetch
   * @returns {Promise<Object>} Product data
   */
  async fetchProductById(productId) {
    try {
      const accessToken = await this.getAccessToken();
      const response = await this.fetchWithToken(accessToken, `/products/${productId}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to fetch product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Splits an array into chunks of specified size
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Gets product counts by status from commercetools
   * @returns {Promise<Object>} Product counts by status
   */
  async getProductCounts() {
    try {
      const accessToken = await this.getAccessToken();
      
      // Get total count
      const totalResponse = await this.fetchWithToken(accessToken, '/products?limit=1');
      const totalCount = totalResponse.total;
      
      // Get products with staged changes
      const stagedResponse = await this.fetchWithToken(accessToken, '/products?limit=1&where=masterData(hasStagedChanges=true)');
      const stagedCount = stagedResponse.total;
      
      // Calculate published (total minus staged)
      const publishedCount = totalCount - stagedCount;
      
      return {
        total: totalCount,
        published: publishedCount,
        staged: stagedCount,
        draft: 0 // Draft products are not accessible via API
      };
    } catch (error) {
      console.error('❌ Failed to get product counts:', error);
      throw error;
    }
  }

  /**
   * Syncs a single product to Vertex AI
   * @param {string} productId - Product ID to sync
   * @param {string} action - Action to perform ('upsert' or 'delete')
   * @returns {Promise<Object>} Sync result
   */
  async syncProduct(productId, action = 'upsert') {
    try {
      if (action === 'delete') {
        return await this.vertexService.deleteProduct(productId);
      } else {
        const product = await this.fetchProductById(productId);
        return await this.vertexService.upsertProduct(product);
      }
    } catch (error) {
      console.error(`❌ Failed to sync product ${productId}:`, error);
      throw error;
    }
  }
}

module.exports = { ProductExportService }; 