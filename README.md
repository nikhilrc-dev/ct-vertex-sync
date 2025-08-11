# Commercetools to Vertex AI Connect Application

This connect application synchronizes product data from commercetools to Google Cloud Vertex AI Search for Commerce (Retail API) in real-time.

## 🚀 Recent Updates

- ✅ **Enhanced Product Fetching**: Now correctly fetches all ~5000 products (previously only 669)
- ✅ **Environment Variable Migration**: Moved from `vertex-key.json` to environment variables for better deployment compatibility
- ✅ **Code Cleanup**: Improved code structure, documentation, and error handling
- ✅ **Better Logging**: Enhanced progress indicators and debugging information
- ✅ **Production Ready**: Optimized for commercetools Connect platform deployment

## Architecture

- **Full Export Service** (`full-export/`) - Handles initial bulk data synchronization
- **Incremental Updater** (`incremental-updater/`) - Handles real-time product updates via commercetools messages

## Prerequisites

### Google Cloud Setup
1. Enable Vertex AI Search for Commerce API
2. Create service account with `retail.admin` role
3. Extract service account credentials for environment variables

### Commercetools Setup
1. Create API client with scopes: `manage_products:view_products:manage_stores:view_stores`
2. Configure message subscriptions for product events

## Configuration

### Environment Variables

Create a `.env` file with your credentials:

```bash
# Commercetools Configuration
CTP_PROJECT_KEY=your-commercetools-project-key
CTP_CLIENT_ID=your-commercetools-client-id
CTP_CLIENT_SECRET=your-commercetools-client-secret
CTP_SCOPE=manage_products:view_products:manage_stores:view_stores
CTP_REGION=gcp-us-central1

# Store Configuration (for incremental updater)
CTP_STORE_KEY=your-store-key

# Vertex AI Configuration
VERTEX_PROJECT_ID=your-vertex-project-id
VERTEX_LOCATION=global
VERTEX_CATALOG_ID=default_catalog
VERTEX_BRANCH_ID=0

# Google Cloud Service Account Credentials
VERTEX_SERVICE_ACCOUNT_TYPE=service_account
VERTEX_SERVICE_ACCOUNT_PROJECT_ID=your-project-id
VERTEX_SERVICE_ACCOUNT_PRIVATE_KEY_ID=your-private-key-id
VERTEX_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
VERTEX_SERVICE_ACCOUNT_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
VERTEX_SERVICE_ACCOUNT_CLIENT_ID=your-client-id
VERTEX_SERVICE_ACCOUNT_AUTH_URI=https://accounts.google.com/o/oauth2/auth
VERTEX_SERVICE_ACCOUNT_TOKEN_URI=https://oauth2.googleapis.com/token
VERTEX_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
VERTEX_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com
```

## Deployment

### Local Development

1. **Install dependencies**:
   ```bash
   cd full-export && npm install
   cd ../incremental-updater && npm install
   ```

2. **Set up environment variables**:
   ```bash
   # Copy the .env file and update with your credentials
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Test locally**:
   ```bash
   # Test full-export service
   cd full-export && npm start
   
   # Test incremental-updater service (in another terminal)
   cd incremental-updater && npm start
   ```

### Commercetools Connect Deployment

1. **Deploy to Commercetools Connect**:
   ```bash
   connect deploy
   ```

2. **Configure environment variables** in commercetools Connect:
   - Set all the environment variables from your `.env` file
   - Ensure Vertex AI credentials are properly configured

3. **Configure message subscriptions** for:
   - Product events (create, update, delete)
   - Store events
   - Product selection events

## Usage

### Health Check
```bash
# Full Export Service
curl https://your-full-export-url/health

# Incremental Updater Service
curl https://your-incremental-updater-url/health
```

### Product Counts
```bash
# Get product counts from commercetools
curl https://your-full-export-url/productCounts
```

### Full Sync
```bash
# Trigger full product synchronization
curl -X POST https://your-full-export-url/fullSync \
  -H "Authorization: Bearer YOUR_CTP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Manual Product Sync
```bash
# Sync individual product (incremental updater)
curl -X POST https://your-incremental-updater-url/sync/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"action": "upsert"}'
```

### Delta Sync (Event-driven)
```bash
# This endpoint is called automatically by commercetools
# when product events occur
curl -X POST https://your-incremental-updater-url/deltaSync \
  -H "Content-Type: application/json" \
  -d '{"message": "product_event_data"}'
```

## Features

- ✅ **Enhanced Product Fetching**: Correctly fetches all ~5000 products using optimized pagination
- ✅ **Real-time Product Synchronization**: Event-driven updates via commercetools messages
- ✅ **Automatic Catalog Creation**: Creates and manages Vertex AI catalogs automatically
- ✅ **Product Lifecycle Management**: Handles product creation, updates, and deletions
- ✅ **Store-based Product Filtering**: Supports store-specific product selections
- ✅ **Batch Processing**: Efficient processing of large datasets (50 products per batch)
- ✅ **Robust Error Handling**: Comprehensive error handling with retry logic
- ✅ **Health Check Endpoints**: Service health monitoring and diagnostics
- ✅ **Product Count Analytics**: Real-time product count information
- ✅ **Enhanced Logging**: Detailed progress indicators and debugging information
- ✅ **Environment Variable Configuration**: Secure credential management
- ✅ **Production Ready**: Optimized for commercetools Connect platform

## File Structure

```
connect-app/
├── connect.yaml              # Connect deployment configuration
├── .env                      # Environment variables (create from .env.example)
├── full-export/              # Full export service
│   ├── package.json
│   └── src/
│       ├── index.js          # Main application entry point
│       └── services/
│           ├── vertex-service.js           # Vertex AI integration
│           └── product-export-service.js   # Product fetching and sync
├── incremental-updater/       # Incremental updater service
│   ├── package.json
│   └── src/
│       ├── index.js          # Main application entry point
│       ├── handlers/
│       │   └── message-handler.js          # Event message processing
│       └── services/
│           ├── vertex-service.js           # Vertex AI integration
│           └── product-sync-service.js     # Product sync operations
├── package.json              # Root dependencies
└── README.md                 # This file
```

## API Endpoints

### Full Export Service
- `GET /health` - Health check
- `GET /productCounts` - Get product counts by status
- `POST /fullSync` - Trigger full product synchronization

### Incremental Updater Service
- `GET /health` - Health check
- `POST /deltaSync` - Handle real-time product events
- `POST /sync/:productId` - Manual product synchronization

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify all Vertex AI environment variables are set correctly
   - Check that `VERTEX_SERVICE_ACCOUNT_PRIVATE_KEY` is properly escaped
   - Ensure commercetools credentials are valid

2. **Product Sync Failures**:
   - Check commercetools API credentials and scopes
   - Verify Vertex AI project and catalog configuration
   - Review logs for detailed error messages

3. **Product Count Issues**:
   - If only 669 products are fetched instead of 5000, ensure you're using the latest code
   - The enhanced pagination logic should fetch all products correctly

4. **Rate Limiting**:
   - The application uses 50 products per batch with 1-second delays
   - Adjust batch sizes in the code if needed

5. **Environment Variable Issues**:
   - Ensure all required environment variables are set
   - Check that `.env` file is properly formatted
   - For deployment, verify all variables are set in commercetools Connect

### Debugging

- Check service logs for detailed error information
- Use health check endpoints to verify service status
- Test product counts endpoint to verify data access
- Verify Vertex AI credentials with Google Cloud Console

## Migration from Previous Version

If you're upgrading from a previous version that used `vertex-key.json`:

1. **Remove the JSON file**:
   ```bash
   rm vertex-key.json
   ```

2. **Update environment variables**:
   - Extract credentials from your `vertex-key.json` file
   - Set individual environment variables as shown in the Configuration section

3. **Update commercetools Connect configuration**:
   - Replace the single `VERTEX_CONFIG` variable with individual Vertex AI variables
   - See `VERTEX_CONFIG_MIGRATION.md` for detailed instructions

## Performance

- **Product Fetching**: Optimized to fetch all ~5000 products efficiently
- **Batch Processing**: 50 products per batch with 1-second delays
- **Memory Usage**: Efficient pagination to handle large datasets
- **Error Recovery**: Automatic retry logic for failed operations

## Support

For issues and questions:
- Check the troubleshooting section above
- Review service logs for detailed error information
- Test health check endpoints to verify service status
- Contact the development team for additional support

## Changelog

### Latest Version
- ✅ Enhanced product fetching (5000 products vs 669)
- ✅ Migrated from JSON file to environment variables
- ✅ Improved code structure and documentation
- ✅ Enhanced logging and error handling
- ✅ Production-ready optimizations 