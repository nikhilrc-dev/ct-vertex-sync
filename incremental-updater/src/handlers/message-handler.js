class MessageHandler {
  constructor(productSyncService, storeKey) {
    this.productSyncService = productSyncService;
    this.storeKey = storeKey;
  }

  async handleMessage(message) {
    try {
      // Handle CloudEvent format - extract data from nested structure
      let messageData = message;
      if (message.data) {
        messageData = message.data;
      }

      console.log('Processing message:', {
        type: messageData.type,
        resourceTypeId: messageData.resource?.typeId,
        resourceId: messageData.resource?.id,
        version: messageData.version
      });

      const { type, resource, resourceUserProvidedIdentifiers } = messageData;
      const resourceTypeId = resource?.typeId;
      const resourceId = resource?.id;

      // Handle different message types
      switch (resourceTypeId) {
        case 'product':
          return await this.handleProductMessage(type, resourceId, message);
        
        case 'store':
          return await this.handleStoreMessage(type, resourceId, message);
        
        case 'product-selection':
          return await this.handleProductSelectionMessage(type, resourceId, message);
        
        default:
          console.log(`Unhandled resource type: ${resourceTypeId}`);
          return { success: true, message: 'Unhandled resource type' };
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
      throw error;
    }
  }

  async handleProductMessage(type, productId, message) {
    console.log(`Handling product message: ${type} for product ${productId}`);

    switch (type) {
      case 'ProductCreated':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      case 'ProductPublished':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      case 'ProductUnpublished':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      case 'ProductDeleted':
        return await this.productSyncService.syncProduct(productId, 'delete');
      
      case 'ProductVariantAdded':
      case 'ProductVariantRemoved':
      case 'ProductVariantUpdated':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      case 'ProductPriceChanged':
      case 'ProductPriceRemoved':
      case 'ProductPriceAdded':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      case 'ProductSlugChanged':
      case 'ProductNameChanged':
      case 'ProductDescriptionChanged':
      case 'ProductMetaTitleChanged':
      case 'ProductMetaDescriptionChanged':
      case 'ProductMetaKeywordsChanged':
        return await this.productSyncService.syncProductWithStoreCheck(productId, this.storeKey, 'upsert');
      
      default:
        console.log(`Unhandled product message type: ${type}`);
        return { success: true, message: 'Unhandled product message type' };
    }
  }

  async handleStoreMessage(type, storeId, message) {
    console.log(`Handling store message: ${type} for store ${storeId}`);

    switch (type) {
      case 'StoreProductSelectionsChanged':
        // When store product selections change, sync all products for the store
        return await this.productSyncService.syncStoreProducts(this.storeKey);
      
      case 'StoreCreated':
      case 'StoreDeleted':
      case 'StoreNameChanged':
        // These don't directly affect product sync, but we might want to log them
        console.log(`Store message type ${type} received for store ${storeId}`);
        return { success: true, message: 'Store message processed' };
      
      default:
        console.log(`Unhandled store message type: ${type}`);
        return { success: true, message: 'Unhandled store message type' };
    }
  }

  async handleProductSelectionMessage(type, productSelectionId, message) {
    console.log(`Handling product selection message: ${type} for product selection ${productSelectionId}`);

    switch (type) {
      case 'ProductSelectionProductAdded':
        // A product was added to a product selection
        const addedProductId = message.resourceUserProvidedIdentifiers?.key || message.resourceId;
        return await this.productSyncService.syncProductWithStoreCheck(addedProductId, this.storeKey, 'upsert');
      
      case 'ProductSelectionProductRemoved':
        // A product was removed from a product selection
        const removedProductId = message.resourceUserProvidedIdentifiers?.key || message.resourceId;
        return await this.productSyncService.syncProductWithStoreCheck(removedProductId, this.storeKey, 'upsert');
      
      case 'ProductSelectionVariantSelectionChanged':
        // Product variant selection changed in a product selection
        const changedProductId = message.resourceUserProvidedIdentifiers?.key || message.resourceId;
        return await this.productSyncService.syncProductWithStoreCheck(changedProductId, this.storeKey, 'upsert');
      
      case 'ProductSelectionCreated':
      case 'ProductSelectionDeleted':
        // When a product selection is created or deleted, sync all products for the store
        return await this.productSyncService.syncStoreProducts(this.storeKey);
      
      default:
        console.log(`Unhandled product selection message type: ${type}`);
        return { success: true, message: 'Unhandled product selection message type' };
    }
  }

  extractProductIdFromMessage(message) {
    // Try to extract product ID from various message formats
    if (message.resourceUserProvidedIdentifiers?.key) {
      return message.resourceUserProvidedIdentifiers.key;
    }
    
    if (message.resourceId) {
      return message.resourceId;
    }
    
    // For some message types, the product ID might be in the message body
    if (message.resource && message.resource.id) {
      return message.resource.id;
    }
    
    throw new Error('Could not extract product ID from message');
  }
}

module.exports = { MessageHandler }; 