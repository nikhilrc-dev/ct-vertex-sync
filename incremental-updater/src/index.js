/**
 * Incremental Updater Service - Handles real-time product synchronization from commercetools to Vertex AI
 * 
 * This service provides endpoints for:
 * - Health checks
 * - Delta synchronization (event-driven)
 * - Manual product synchronization
 */

require('dotenv').config();

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

// Security and middleware setup
app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * Initialize commercetools client based on region
 */
const getCommercetoolsHost = () => {
  switch (process.env.CTP_REGION) {
    case 'gcp-europe-west1':
      return 'https://api.europe-west1.gcp.commercetools.com';
    case 'gcp-us-central1':
      return 'https://api.us-central1.gcp.commercetools.com';
    default:
      return 'https://api.commercetools.com';
  }
};

const commercetoolsClient = createClient({
  middlewares: [
    createAuthMiddlewareForClientCredentialsFlow({
      host: getCommercetoolsHost(),
      projectKey: process.env.CTP_PROJECT_KEY,
      credentials: {
        clientId: process.env.CTP_CLIENT_ID,
        clientSecret: process.env.CTP_CLIENT_SECRET,
      },
      scopes: [`manage_project:${process.env.CTP_PROJECT_KEY}`],
    }),
    createHttpMiddleware({ host: getCommercetoolsHost() }),
    createUserAgentMiddleware(),
  ],
});

/**
 * Build Vertex AI configuration from environment variables
 */
const buildVertexConfig = () => ({
  PROJECT_ID: process.env.VERTEX_PROJECT_ID || 'whitecap-us',
  LOCATION: process.env.VERTEX_LOCATION || 'global',
  CATALOG_ID: process.env.VERTEX_CATALOG_ID || 'default_catalog',
  BRANCH_ID: process.env.VERTEX_BRANCH_ID || '0',
  CREDENTIALS: {
    type: process.env.VERTEX_SERVICE_ACCOUNT_TYPE || 'service_account',
    project_id: process.env.VERTEX_SERVICE_ACCOUNT_PROJECT_ID || 'whitecap-us',
    private_key_id: process.env.VERTEX_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: process.env.VERTEX_SERVICE_ACCOUNT_PRIVATE_KEY,
    client_email: process.env.VERTEX_SERVICE_ACCOUNT_CLIENT_EMAIL,
    client_id: process.env.VERTEX_SERVICE_ACCOUNT_CLIENT_ID,
    auth_uri: process.env.VERTEX_SERVICE_ACCOUNT_AUTH_URI,
    token_uri: process.env.VERTEX_SERVICE_ACCOUNT_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.VERTEX_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.VERTEX_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
    universe_domain: process.env.VERTEX_SERVICE_ACCOUNT_UNIVERSE_DOMAIN
  }
});

// Initialize services
const vertexService = new VertexService(JSON.stringify(buildVertexConfig()));
const productSyncService = new ProductSyncService(commercetoolsClient, vertexService);
const messageHandler = new MessageHandler(productSyncService, process.env.CTP_STORE_KEY);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'incremental-updater',
    storeKey: process.env.CTP_STORE_KEY
  });
});

/**
 * Delta sync endpoint - Handles real-time product change events from commercetools
 */
app.post('/deltaSync', async (req, res) => {
  try {
    console.log('🔄 Delta sync request received');
    console.log('📋 Request headers:', req.headers);
    console.log('📋 Request body type:', typeof req.body);
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    
    const message = req.body;
    
    if (!message || Object.keys(message).length === 0) {
      console.log('⚠️ Empty message received');
      return res.status(200).json({
        success: true,
        message: 'Empty message received and ignored'
      });
    }
    
    const result = await messageHandler.handleMessage(message);
    
    res.status(200).json({
      success: true,
      message: 'Message processed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Delta sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Delta sync failed',
      error: error.message
    });
  }
});

/**
 * Manual sync endpoint - For testing individual product synchronization
 */
app.post('/sync/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { action = 'upsert' } = req.body;
    
    console.log(`🔧 Manual sync request for product ${productId} (action: ${action})`);
    
    const result = await productSyncService.syncProduct(productId, action);
    
    res.status(200).json({
      success: true,
      message: 'Manual sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Manual sync failed',
      error: error.message
    });
  }
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`🚀 Incremental updater service running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔄 Delta sync: POST http://localhost:${port}/deltaSync`);
  console.log(`🔧 Manual sync: POST http://localhost:${port}/sync/:productId`);
});

module.exports = app; 