class MessageHandler {
  constructor(productSyncService, storeKey) {
    this.productSyncService = productSyncService;
    this.storeKey = storeKey;
  }

  async handleMessage(message) {
    try {
      console.log('🔍 Raw message received:', JSON.stringify(message, null, 2));
      
      // Handle different message formats
      let messageData = message;
      let resourceTypeId, resourceId, type;
      
      // Try to extract data from different possible structures
      if (message.data) {
        messageData = message.data;
        console.log('📦 Extracted data from message.data');
      }
      
      if (message.message) {
        messageData = message.message;
        console.log('📦 Extracted data from message.message');
      }
      
      // Try to get resource type and ID from various possible locations
      resourceTypeId = messageData.resource?.typeId || 
                      messageData.resourceTypeId || 
                      messageData.resourceType ||
                      messageData.typeId;
      
      resourceId = messageData.resource?.id || 
                  messageData.resourceId || 
                  messageData.id;
      
      type = messageData.type || 
             messageData.messageType || 
             messageData.eventType;
      
      console.log('🔍 Extracted message info:', {
        type: type,
        resourceTypeId: resourceTypeId,
        resourceId: resourceId,
        version: messageData.version,
        messageKeys: Object.keys(messageData)
      });
      
      // If we still don't have the required fields, try to extract from the raw message
      if (!resourceTypeId || !resourceId || !type) {
        console.log('⚠️ Could not extract required fields, trying alternative parsing...');
        
        // Try to find product ID in various locations
        const possibleProductId = messageData.productId || 
                                 messageData.product?.id || 
                                 messageData.id ||
                                 messageData.key;
        
        if (possibleProductId) {
          console.log(`🔍 Found possible product ID: ${possibleProductId}`);
          return await this.handleProductMessage('ProductUpdated', possibleProductId, message);
        }
        
        console.log('❌ Could not extract any useful information from message');
        return { success: true, message: 'Message received but could not parse' };
      }

      // Handle different message types
      switch (resourceTypeId) {
        case 'product':
          return await this.handleProductMessage(type, resourceId, message);
        
        case 'store':
          return await this.handleStoreMessage(type, resourceId, message);
        
        case 'product-selection':
          return await this.handleProductSelectionMessage(type, resourceId, message);
        
        default:
          console.log(`❌ Unhandled resource type: ${resourceTypeId}`);
          return { success: true, message: `Unhandled resource type: ${resourceTypeId}` };
      }
    } catch (error) {
      console.error('❌ Failed to handle message:', error);
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