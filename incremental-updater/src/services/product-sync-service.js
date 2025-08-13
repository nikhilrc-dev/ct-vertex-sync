const { HybridService } = require('./hybrid-service');

class ProductSyncService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
    this.hybridService = new HybridService();
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
      console.log(`🔍 Fetching product ${productId} using Hybrid Service (GraphQL + REST)...`);
      
      // Use Hybrid service to fetch product with names instead of IDs and real availability data
      const product = await this.hybridService.fetchProductById(productId);
      
      console.log(`✅ Successfully fetched product ${productId} via Hybrid Service`);
      return product;
    } catch (error) {
      console.error(`❌ Failed to fetch product ${productId} via Hybrid Service:`, error);
      throw error;
    }
  }



  // Store and Product Selection methods removed since they're not needed
  // Focus on core product sync functionality only
}

module.exports = { ProductSyncService }; 