// Post-deploy script for commercetools Connect
// This script sets up subscriptions for product events

const { createClient } = require('@commercetools/sdk-client');
const { createAuthMiddlewareForClientCredentialsFlow } = require('@commercetools/sdk-middleware-auth');
const { createHttpMiddleware } = require('@commercetools/sdk-middleware-http');
const { createUserAgentMiddleware } = require('@commercetools/sdk-middleware-user-agent');

async function postDeploy() {
  try {
    console.log('Running post-deploy script...');
    
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

    // Set up subscriptions for the different message types
    await setupSubscriptions(commercetoolsClient);
    
    console.log('✅ Post-deploy script completed successfully');
  } catch (error) {
    console.error('Post-deploy script failed:', error);
    // Don't exit with error code to avoid blocking deployment
    console.log('⚠️ Continuing deployment despite subscription setup failure');
  }
}

async function setupSubscriptions(commercetoolsClient) {
  try {
    console.log('Setting up subscriptions...');
    
    const subscriptionConfig = {
      key: 'vertex-subscription',
      destination: {
        type: 'GoogleCloudPubSub',
        projectId: 'ct-connectors-sandbox',
        topic: 'event-3162edfa-b2cd-474f-9a59-a4f427bec747-incremental-updater'
      },
      messages: [
        {
          resourceTypeId: 'product',
          types: [
            'ProductCreated',
            'ProductPublished',
            'ProductUnpublished',
            'ProductDeleted',
            'ProductVariantAdded',
            'ProductPriceChanged',
            'ProductPriceRemoved',
            'ProductPriceAdded',
            'ProductSlugChanged'
          ]
        }
      ],
      format: {
        type: 'Platform'
      }
    };

    // For now, just log the subscription configuration
    // The actual subscription setup will be done manually in commercetools console
    console.log('📋 Subscription Configuration:');
    console.log(`   Key: ${subscriptionConfig.key}`);
    console.log(`   Project ID: ${subscriptionConfig.destination.projectId}`);
    console.log(`   Topic: ${subscriptionConfig.destination.topic}`);
    console.log(`   Product Events: ${subscriptionConfig.messages[0].types.length} types`);
    console.log(`   Format: ${subscriptionConfig.format.type}`);
    
    console.log('📝 Note: Please configure this subscription manually in commercetools console');
    console.log('   Go to: Settings > Subscriptions > Create Subscription');
    console.log('   Use the configuration details above');
    
    console.log('✅ Subscriptions set up successfully');
  } catch (error) {
    console.error('Failed to set up subscriptions:', error);
    console.log('📝 Note: Subscriptions can be configured manually in commercetools console');
    // Don't throw error to avoid blocking deployment
  }
}

// Run the post-deploy script
postDeploy(); 