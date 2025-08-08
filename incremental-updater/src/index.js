// Load environment variables
require('dotenv').config();

// Debug environment variables
// Environment variables loaded

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@commercetools/sdk-client');
const { createAuthMiddlewareForClientCredentialsFlow } = require('@commercetools/sdk-middleware-auth');
const { createHttpMiddleware } = require('@commercetools/sdk-middleware-http');
const { createUserAgentMiddleware } = require('@commercetools/sdk-middleware-user-agent');

const { VertexService } = require('./services/vertex-service');
const { ProductSyncService } = require('./services/product-sync-service');
const { MessageHandler } = require('./handlers/message-handler');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize commercetools client
const host = process.env.CTP_REGION === 'gcp-europe-west1' 
  ? 'https://api.europe-west1.gcp.commercetools.com'
  : process.env.CTP_REGION === 'us-central1.gcp'
  ? 'https://api.us-central1.gcp.commercetools.com'
  : 'https://api.commercetools.com';

  // Initializing commercetools client

const commercetoolsClient = createClient({
  middlewares: [
    createAuthMiddlewareForClientCredentialsFlow({
      host: host,
      projectKey: process.env.CTP_PROJECT_KEY,
      credentials: {
        clientId: process.env.CTP_CLIENT_ID,
        clientSecret: process.env.CTP_CLIENT_SECRET,
      },
      scopes: [`manage_project:${process.env.CTP_PROJECT_KEY}`],
    }),
    createHttpMiddleware({ host }),
    createUserAgentMiddleware(),
  ],
});

// Initialize services
const vertexService = new VertexService(process.env.VERTEX_CONFIG);
const productSyncService = new ProductSyncService(commercetoolsClient, vertexService);
const messageHandler = new MessageHandler(productSyncService, process.env.CTP_STORE_KEY);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    storeKey: process.env.CTP_STORE_KEY
  });
});

// Delta sync endpoint for handling commercetools messages
app.post('/deltaSync', async (req, res) => {
  try {
    // Received delta sync request
    
    const message = req.body;
    const result = await messageHandler.handleMessage(message);
    
    res.status(200).json({
      success: true,
      message: 'Message processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Delta sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Delta sync failed',
      error: error.message
    });
  }
});

// Manual sync endpoint for testing
app.post('/sync/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { action = 'upsert' } = req.body;
    
          // Manual sync request
    
    const result = await productSyncService.syncProduct(productId, action);
    
    res.status(200).json({
      success: true,
      message: 'Manual sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Manual sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Manual sync failed',
      error: error.message
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Incremental updater service running on port ${port}`);
});

module.exports = app; 