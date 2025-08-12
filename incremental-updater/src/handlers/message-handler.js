class MessageHandler {
  constructor(productSyncService, storeKey) {
    this.productSyncService = productSyncService;
    this.storeKey = storeKey;
  }

  async handleMessage(message) {
    try {
      // Handle different message formats
      let messageData = message;
      let resourceTypeId, resourceId, type;
      
      // Handle Google Cloud Pub/Sub message format
      if (message.message && message.message.data) {
        try {
          // Decode base64 data from Pub/Sub message
          const decodedData = Buffer.from(message.message.data, 'base64').toString('utf-8');
          
          try {
            const parsedData = JSON.parse(decodedData);
            messageData = parsedData;
          } catch (parseError) {
            messageData = { rawData: decodedData };
          }
        } catch (decodeError) {
          // Continue with original message
        }
      }
      
      // Try to extract data from different possible structures
      if (message.data && !messageData.rawData) {
        messageData = message.data;
      }
      
      // Only try message.message if we haven't already decoded Pub/Sub data
      if (message.message && !messageData.rawData && !messageData.resource) {
        messageData = message.message;
      }
      
      // Extract fields based on notification type
      if (messageData.notificationType === 'Message') {
        // Message notification - contains predefined Messages
        resourceTypeId = messageData.resource?.typeId;
        resourceId = messageData.resource?.id;
        type = messageData.type;
      } else if (messageData.notificationType === 'Change') {
        // Change notification - contains resource change information
        resourceTypeId = messageData.resourceTypeId;
        resourceId = messageData.resourceId;
        type = messageData.changeType || messageData.type;
      } else if (messageData.notificationType === 'Event') {
        // Event notification - contains predefined Events
        resourceTypeId = messageData.resourceType;
        resourceId = messageData.resourceId;
        type = messageData.type;
      } else {
        // Fallback to generic extraction
        resourceTypeId = messageData.resource?.typeId || 
                        messageData.resourceTypeId || 
                        messageData.resourceType ||
                        messageData.typeId;
        
        resourceId = messageData.resource?.id || 
                    messageData.resourceId || 
                    messageData.id;
        
        type = messageData.type || 
               messageData.messageType || 
               messageData.eventType ||
               messageData.changeType;
      }
      
      // If we still don't have the required fields, try to extract from the raw message
      if (!resourceTypeId || !resourceId || !type) {
        // Try to find product ID in various locations
        const possibleProductId = messageData.productId || 
                                 messageData.product?.id || 
                                 messageData.id ||
                                 messageData.key ||
                                 messageData.subject;
        
        if (possibleProductId) {
          return await this.handleProductMessage('ProductUpdated', possibleProductId, message);
        }
        
        // Try to extract from raw decoded data if available
        if (messageData.rawData) {
          // Look for common patterns in the raw data
          const productIdMatch = messageData.rawData.match(/"id"\s*:\s*"([^"]+)"/);
          const typeMatch = messageData.rawData.match(/"type"\s*:\s*"([^"]+)"/);
          
          if (productIdMatch && typeMatch) {
            const extractedProductId = productIdMatch[1];
            const extractedType = typeMatch[1];
            return await this.handleProductMessage(extractedType, extractedProductId, message);
          }
        }
        
        return { success: true, message: 'Message received but could not parse' };
      }

      // Handle different message types
      switch (resourceTypeId) {
        case 'product':
          return await this.handleProductMessage(type, resourceId, message);
        
        default:
          return { success: true, message: `Unhandled resource type: ${resourceTypeId}` };
      }
    } catch (error) {
      console.error('❌ Failed to handle message:', error);
      throw error;
    }
  }

  async handleProductMessage(type, productId, message) {
    console.log(`🔄 Processing ${type} for product ${productId}`);

    switch (type) {
      case 'ProductCreated':
      case 'ProductPublished':
      case 'ProductUnpublished':
      case 'ProductVariantAdded':
      case 'ProductVariantRemoved':
      case 'ProductVariantUpdated':
      case 'ProductPriceChanged':
      case 'ProductPriceRemoved':
      case 'ProductPriceAdded':
      case 'ProductSlugChanged':
      case 'ProductNameChanged':
      case 'ProductDescriptionChanged':
      case 'ProductMetaTitleChanged':
      case 'ProductMetaDescriptionChanged':
      case 'ProductMetaKeywordsChanged':
        return await this.productSyncService.syncProduct(productId, 'upsert');
      
      case 'ProductDeleted':
        return await this.productSyncService.syncProduct(productId, 'delete');
      
      default:
        return { success: true, message: 'Unhandled product message type' };
    }
  }

  // Store and Product Selection handlers removed since they're not needed
  // Focus on core product sync functionality only

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