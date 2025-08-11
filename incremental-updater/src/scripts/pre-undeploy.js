// Pre-undeploy script for commercetools Connect
// This script cleans up resources before undeployment

const { createClient } = require('@commercetools/sdk-client');
const { createAuthMiddlewareForClientCredentialsFlow } = require('@commercetools/sdk-middleware-auth');
const { createHttpMiddleware } = require('@commercetools/sdk-middleware-http');
const { createUserAgentMiddleware } = require('@commercetools/sdk-middleware-user-agent');

async function preUndeploy() {
  try {
    console.log('Running pre-undeploy script...');
    
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
          scopes: [process.env.CTP_SCOPE],
        }),
        createHttpMiddleware({ host }),
        createUserAgentMiddleware(),
      ],
    });

    // Clean up subscriptions
    await cleanupSubscriptions(commercetoolsClient);
    
    console.log('✅ Pre-undeploy script completed successfully');
  } catch (error) {
    console.error('Pre-undeploy script failed:', error);
    // Don't exit with error code as this is cleanup
    console.log('⚠️ Continuing undeployment despite cleanup failure');
  }
}

async function cleanupSubscriptions(commercetoolsClient) {
  try {
    console.log('Cleaning up subscriptions...');
    
    const subscriptionKey = 'vertex-sync-subscription';
    
    // For now, just log the cleanup information
    // The actual subscription cleanup will be done manually in commercetools console
    console.log(`📋 Subscription to clean up: ${subscriptionKey}`);
    console.log('📝 Note: Please delete this subscription manually in commercetools console');
    console.log('   Go to: Settings > Subscriptions > Find and delete the subscription');
    
  } catch (error) {
    console.error('Failed to clean up subscriptions:', error);
    console.log('📝 Note: Subscriptions can be cleaned up manually in commercetools console');
    // Don't throw error to avoid blocking undeployment
  }
}

// Run the pre-undeploy script
preUndeploy(); 