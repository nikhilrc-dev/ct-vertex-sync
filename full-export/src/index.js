require('dotenv').config();
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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize commercetools client
const host = process.env.CTP_REGION === 'gcp-europe-west1' 
  ? 'https://api.europe-west1.gcp.commercetools.com'
  : process.env.CTP_REGION === 'gcp-us-central1'
  ? 'https://api.us-central1.gcp.commercetools.com'
  : 'https://api.commercetools.com';

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
const productExportService = new ProductExportService(commercetoolsClient, vertexService);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Full sync endpoint
app.post('/fullSync', async (req, res) => {
  try {
    // Starting full sync process
    
    const result = await productExportService.performFullSync();
    
    res.status(200).json({
      success: true,
      message: 'Full sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Full sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Full sync failed',
      error: error.message
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Full export service running on port ${port}`);
});

module.exports = app; 