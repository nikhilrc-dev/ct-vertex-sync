require('dotenv').config();
const { createClient } = require('@commercetools/sdk-client');
const { createAuthMiddlewareForClientCredentialsFlow } = require('@commercetools/sdk-middleware-auth');
const { createHttpMiddleware } = require('@commercetools/sdk-middleware-http');
const { createUserAgentMiddleware } = require('@commercetools/sdk-middleware-user-agent');
const { VertexService } = require('./full-export/src/services/vertex-service');
const { ProductExportService } = require('./full-export/src/services/product-export-service');

async function testFullExport() {
  try {
    console.log('🚀 Starting full export test for whitecap-us...');
    
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

    console.log('✅ Commercetools client initialized');
    console.log('Project Key:', process.env.CTP_PROJECT_KEY);
    console.log('Region:', process.env.CTP_REGION);
    console.log('Host:', host);

    // Initialize services
    const vertexService = new VertexService(process.env.VERTEX_CONFIG);
    console.log('✅ Vertex service initialized');
    
    const productExportService = new ProductExportService(commercetoolsClient, vertexService);
    console.log('✅ Product export service initialized');

    // Perform full sync
    console.log('\n📦 Starting full sync process...');
    const startTime = Date.now();
    
    const result = await productExportService.performFullSync();
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    console.log('\n✅ Full export completed successfully!');
    console.log('📊 Results:');
    console.log('- Total products found:', result.totalProducts);
    console.log('- Successfully processed:', result.processedCount);
    console.log('- Errors:', result.errorCount);
    console.log('- Duration:', result.duration);
    console.log('- Total time:', `${totalDuration}ms`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Batch ${error.batchIndex + 1}: ${error.error}`);
        console.log(`     Products: ${error.products.join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Full export test failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testFullExport(); 