/**
 * ProductExportService - Handles full synchronization of products from commercetools to Vertex AI
 * Now uses GraphQL API to fetch only necessary data with names instead of IDs
 */
const { HybridService } = require('./hybrid-service');

class ProductExportService {
  constructor(commercetoolsClient, vertexService) {
    this.commercetoolsClient = commercetoolsClient;
    this.vertexService = vertexService;
    this.hybridService = new HybridService();
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

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          const batchResult = await this.vertexService.batchUpsertProducts(batch);
          processedCount += batch.length;
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

      console.log(`✅ Full Sync: Completed in ${duration}ms - ${processedCount} products processed, ${errorCount} errors`);
      return result;

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetches all products from commercetools using Hybrid Service (GraphQL + REST)
   * @returns {Array} Array of all products with names instead of IDs and real availability data
   */
  async fetchAllProducts() {
    try {
      // Use Hybrid service to fetch products with names instead of IDs and real availability data
      const products = await this.hybridService.fetchAllProducts();
      
      console.log(`📥 Full Sync: Fetched ${products.length} products from commercetools`);
      return products;

    } catch (error) {
      console.error('❌ Failed to fetch products from commercetools via Hybrid Service:', error);
      throw error;
    }
  }



  /**
   * Fetches a single product by ID using Hybrid Service
   * @param {string} productId - Product ID to fetch
   * @returns {Promise<Object>} Product data with names instead of IDs and real availability data
   */
  async fetchProductById(productId) {
    try {
      const product = await this.hybridService.fetchProductById(productId);
      return product;
    } catch (error) {
      console.error(`❌ Failed to fetch product ${productId} via Hybrid Service:`, error);
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
   * Gets product counts by status from commercetools using Hybrid Service
   * @returns {Promise<Object>} Product counts by status
   */
  async getProductCounts() {
    try {
      const counts = await this.hybridService.getProductCounts();
      return counts;
    } catch (error) {
      console.error('❌ Failed to get product counts via Hybrid Service:', error);
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