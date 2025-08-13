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
            console.log(`🔍 Extracted from raw data - Product ID: ${extractedProductId}, Type: ${extractedType}`);
            const result = await this.handleProductMessage(extractedType, extractedProductId, message);
            console.log(`✅ Message processing completed - Action: ${result.action || 'unknown'}`);
            return result;
          }
        }
        
        console.log(`⚠️ Message received but could not parse - returning success`);
        return { 
          success: true, 
          action: 'ignored',
          message: 'Message received but could not parse' 
        };
      }

      // Handle different message types
      console.log(`📨 Received message - Resource Type: ${resourceTypeId}, ID: ${resourceId}, Event Type: ${type}`);
      
      let result;
      switch (resourceTypeId) {
        case 'product':
          console.log(`🔄 Processing product event: ${type} for product ID: ${resourceId}`);
          result = await this.handleProductMessage(type, resourceId, message);
          break;
        
        default:
          console.log(`⚠️ Unhandled resource type: ${resourceTypeId} - ignoring message`);
          result = { 
            success: true, 
            action: 'ignored',
            message: `Unhandled resource type: ${resourceTypeId}`,
            resourceTypeId: resourceTypeId,
            resourceId: resourceId,
            type: type
          };
      }
      
      console.log(`✅ Message processing completed - Action: ${result.action || 'unknown'}, Success: ${result.success}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to handle message:', error);
      throw error;
    }
  }

  async handleProductMessage(type, productId, message) {
    console.log(`🔄 Processing ${type} for product ${productId}`);

    try {
      switch (type) {
        // CREATE OPERATIONS - Create product in Vertex AI
        case 'ProductCreated':
          console.log(`📦 Creating product ${productId} in Vertex AI (ProductCreated event)`);
          const createResult = await this.productSyncService.syncProduct(productId, 'upsert');
          console.log(`✅ Product ${productId} created in Vertex AI successfully`);
          return {
            ...createResult,
            action: 'created',
            message: `Product ${productId} created in Vertex AI`
          };

        // PUBLISH OPERATIONS - Create/Update product in Vertex AI
        case 'ProductPublished':
          console.log(`📦 Publishing product ${productId} to Vertex AI (ProductPublished event)`);
          const publishResult = await this.productSyncService.syncProduct(productId, 'upsert');
          console.log(`✅ Product ${productId} published to Vertex AI successfully`);
          return {
            ...publishResult,
            action: 'published',
            message: `Product ${productId} published to Vertex AI`
          };

        // DELETE OPERATIONS - Delete product from Vertex AI
        case 'ProductDeleted':
          console.log(`🗑️ Deleting product ${productId} from Vertex AI (ProductDeleted event)`);
          const deleteResult = await this.productSyncService.syncProduct(productId, 'delete');
          console.log(`✅ Product ${productId} deleted from Vertex AI successfully`);
          return {
            ...deleteResult,
            action: 'deleted',
            message: `Product ${productId} deleted from Vertex AI`
          };

        // UNPUBLISH OPERATIONS - Delete product from Vertex AI
        case 'ProductUnpublished':
          console.log(`🚫 Unpublishing product ${productId} from Vertex AI (ProductUnpublished event)`);
          const unpublishResult = await this.productSyncService.syncProduct(productId, 'delete');
          console.log(`✅ Product ${productId} unpublished from Vertex AI successfully`);
          return {
            ...unpublishResult,
            action: 'unpublished',
            message: `Product ${productId} unpublished from Vertex AI`
          };

        // UPDATE OPERATIONS - Update product in Vertex AI
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
        case 'ProductCategoryAdded':
        case 'ProductCategoryRemoved':
        case 'ProductImagesChanged':
        case 'ProductAttributeAdded':
        case 'ProductAttributeRemoved':
        case 'ProductAttributeChanged':
        case 'ProductStateChanged':
        case 'ProductTaxCategoryChanged':
        case 'ProductSearchKeywordsChanged':
        case 'ProductExternalImageChanged':
        case 'ProductAssetAdded':
        case 'ProductAssetRemoved':
        case 'ProductAssetChanged':
          console.log(`🔄 Updating product ${productId} in Vertex AI (${type} event)`);
          const updateResult = await this.productSyncService.syncProduct(productId, 'upsert');
          console.log(`✅ Product ${productId} updated in Vertex AI successfully`);
          return {
            ...updateResult,
            action: 'updated',
            message: `Product ${productId} updated in Vertex AI (${type})`
          };

        // UNHANDLED EVENTS - Log but don't process
        default:
          console.log(`⚠️ Unhandled product message type: ${type} for product ${productId}`);
          return { 
            success: true, 
            action: 'ignored',
            message: `Unhandled product message type: ${type}`,
            productId: productId
          };
      }
    } catch (error) {
      console.error(`❌ Failed to process ${type} for product ${productId}:`, error);
      throw error;
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