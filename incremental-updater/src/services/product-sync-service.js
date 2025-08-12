class ProductSyncService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
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
      console.error(`❌ Failed to sync product ${productId}:`, error.message);
      throw error;
    }
  }

  // Store-related methods removed since stores are not used
  // Focus on core product sync functionality only

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

  // Store and Product Selection methods removed since they're not needed
  // Focus on core product sync functionality only
}

module.exports = { ProductSyncService }; 