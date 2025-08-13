/**
 * Full Export Service - Handles full synchronization of products from commercetools to Vertex AI
 * 
 * This service provides endpoints for:
 * - Health checks
 * - Product count retrieval
 * - Full product synchronization
 */

// Load environment variables - try .env file first, then use system environment variables
try {
  require('dotenv').config();
} catch (error) {
  console.log('📋 No .env file found, using system environment variables');
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@commercetools/sdk-client');
const { createAuthMiddlewareForClientCredentialsFlow } = require('@commercetools/sdk-middleware-auth');
const { createHttpMiddleware } = require('@commercetools/sdk-middleware-http');
const { createUserAgentMiddleware } = require('@commercetools/sdk-middleware-user-agent');
const { VertexService } = require('./services/vertex-service');
const { ProductExportService } = require('./services/product-export-service');

const app = express();
const port = process.env.PORT || 3000;

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

// Debug environment variables
console.log('🔍 Environment variables check:');
console.log(`  CTP_PROJECT_KEY: ${process.env.CTP_PROJECT_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`  CTP_CLIENT_ID: ${process.env.CTP_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`  CTP_CLIENT_SECRET: ${process.env.CTP_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`  CTP_REGION: ${process.env.CTP_REGION || 'default'}`);

// Initialize services
const vertexService = new VertexService(JSON.stringify(buildVertexConfig()));
const productExportService = new ProductExportService(commercetoolsClient, vertexService);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'full-export'
  });
});

/**
 * Product counts endpoint - Returns counts of products by status
 */
app.get('/productCounts', async (req, res) => {
  try {
    const counts = await productExportService.getProductCounts();
    res.status(200).json({
      success: true,
      message: 'Product counts retrieved successfully',
      data: counts
    });
  } catch (error) {
    console.error('❌ Failed to get product counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product counts',
      error: error.message
    });
  }
});

/**
 * Full sync endpoint - Synchronizes all products from commercetools to Vertex AI
 */
app.post('/fullSync', async (req, res) => {
  try {
    console.log('🚀 Full sync request received');
    
    const result = await productExportService.performFullSync();
    
    res.status(200).json({
      success: true,
      message: 'Full sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Full sync failed',
      error: error.message
    });
  }
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`🚀 Full export service running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📈 Product counts: http://localhost:${port}/productCounts`);
  console.log(`🔄 Full sync: POST http://localhost:${port}/fullSync`);
});

module.exports = app; 