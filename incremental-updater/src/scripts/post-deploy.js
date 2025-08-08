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
    
    console.log('Post-deploy script completed successfully');
  } catch (error) {
    console.error('Post-deploy script failed:', error);
    process.exit(1);
  }
}

async function setupSubscriptions(commercetoolsClient) {
  try {
    console.log('Setting up subscriptions...');
    
    const subscriptionConfig = {
      key: 'vertex-sync-subscription',
      destination: {
        type: 'HTTP',
        url: `${process.env.CONNECT_BASE_URL}/deltaSync`
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
            'ProductVariantRemoved',
            'ProductVariantUpdated',
            'ProductPriceChanged',
            'ProductPriceRemoved',
            'ProductPriceAdded',
            'ProductSlugChanged',
            'ProductNameChanged',
            'ProductDescriptionChanged',
            'ProductMetaTitleChanged',
            'ProductMetaDescriptionChanged',
            'ProductMetaKeywordsChanged'
          ]
        },
        {
          resourceTypeId: 'store',
          types: [
            'StoreProductSelectionsChanged',
            'StoreCreated',
            'StoreDeleted',
            'StoreNameChanged'
          ]
        },
        {
          resourceTypeId: 'product-selection',
          types: [
            'ProductSelectionProductAdded',
            'ProductSelectionProductRemoved',
            'ProductSelectionVariantSelectionChanged',
            'ProductSelectionCreated',
            'ProductSelectionDeleted'
          ]
        }
      ]
    };

    // Check if subscription already exists
    try {
      await commercetoolsClient
        .subscriptions()
        .withKey({ key: subscriptionConfig.key })
        .get()
        .execute();
      
      console.log('Subscription already exists, updating...');
      
      // Update existing subscription
      await commercetoolsClient
        .subscriptions()
        .withKey({ key: subscriptionConfig.key })
        .post({
          body: subscriptionConfig
        })
        .execute();
      
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('Creating new subscription...');
        
        // Create new subscription
        await commercetoolsClient
          .subscriptions()
          .post({
            body: subscriptionConfig
          })
          .execute();
      } else {
        throw error;
      }
    }
    
    console.log('Subscriptions set up successfully');
  } catch (error) {
    console.error('Failed to set up subscriptions:', error);
    throw error;
  }
}

// Run the post-deploy script
postDeploy(); 