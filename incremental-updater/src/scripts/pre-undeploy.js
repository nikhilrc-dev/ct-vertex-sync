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
    
    console.log('Pre-undeploy script completed successfully');
  } catch (error) {
    console.error('Pre-undeploy script failed:', error);
    // Don't exit with error code as this is cleanup
  }
}

async function cleanupSubscriptions(commercetoolsClient) {
  try {
    console.log('Cleaning up subscriptions...');
    
    const subscriptionKey = 'vertex-sync-subscription';
    
    // Try to delete the subscription
    try {
      await commercetoolsClient
        .subscriptions()
        .withKey({ key: subscriptionKey })
        .delete()
        .execute();
      
      console.log('Subscription deleted successfully');
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('Subscription not found, nothing to clean up');
      } else {
        console.error('Failed to delete subscription:', error);
      }
    }
    
  } catch (error) {
    console.error('Failed to clean up subscriptions:', error);
    throw error;
  }
}

// Run the pre-undeploy script
preUndeploy(); 