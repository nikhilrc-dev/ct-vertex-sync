# Commercetools to Vertex AI Connect Application

This connect application synchronizes product data from commercetools to Google Cloud Vertex AI Search for Commerce (Retail API) in real-time.

## Architecture

- **Full Export Service** (`full-export/`) - Handles initial bulk data synchronization
- **Incremental Updater** (`incremental-updater/`) - Handles real-time product updates via commercetools messages

## Prerequisites

### Google Cloud Setup
1. Enable Vertex AI Search for Commerce API
2. Create service account with `retail.admin` role
3. Download service account key as `vertex-key.json`

### Commercetools Setup
1. Create API client with scopes: `manage_products:view_products:manage_stores:view_stores`
2. Configure message subscriptions for product events

## Configuration

Update `config-template.env` with your credentials:

```bash
# Commercetools Configuration
CTP_PROJECT_KEY=your-commercetools-project-key
CTP_CLIENT_ID=your-commercetools-client-id
CTP_CLIENT_SECRET=your-commercetools-client-secret
CTP_SCOPE=manage_products:view_products:manage_stores:view_stores
CTP_REGION=gcp-europe-west1

# Store Configuration (for incremental updater)
CTP_STORE_KEY=your-store-key

# Vertex AI Configuration (JSON string)
VERTEX_CONFIG={"PROJECT_ID":"706077349482","LOCATION":"global","CATALOG_ID":"default_catalog","BRANCH_ID":"0","KEY_FILE_PATH":"vertex-key.json"}
```

## Deployment

1. **Install dependencies**:
   ```bash
   cd full-export && npm install
   cd ../incremental-updater && npm install
   ```

2. **Deploy to Commercetools Connect**:
   ```bash
   connect deploy
   ```

3. **Configure message subscriptions** for:
   - Product events (create, update, delete)
   - Store events
   - Product selection events

## Usage

### Health Check
```bash
curl https://your-app-url/health
```

### Manual Product Sync
```bash
curl -X POST https://your-app-url/sync/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"action": "upsert"}'
```

### Full Sync
```bash
curl -X POST https://your-app-url/fullSync
```

## Features

- ✅ Real-time product synchronization
- ✅ Automatic catalog creation in Vertex AI
- ✅ Product creation, update, and deletion handling
- ✅ Store-based product filtering
- ✅ Batch processing for large datasets
- ✅ Error handling and retry logic
- ✅ Health check endpoints
- ✅ Comprehensive logging

## File Structure

```
connect-app/
├── connect.yaml              # Connect deployment configuration
├── full-export/              # Full export service
│   ├── package.json
│   └── src/
│       ├── index.js
│       └── services/
│           ├── vertex-service.js
│           └── product-export-service.js
├── incremental-updater/       # Incremental updater service
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── handlers/
│       │   └── message-handler.js
│       └── services/
│           ├── vertex-service.js
│           └── product-sync-service.js
├── vertex-key.json           # Google Cloud service account key
├── config-template.env       # Configuration template
├── package.json              # Root dependencies
└── README.md                 # This file
```

## Troubleshooting

1. **Authentication Errors**: Verify `vertex-key.json` exists and is valid
2. **Product Sync Failures**: Check commercetools API credentials
3. **Rate Limiting**: Reduce batch sizes or increase delays

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs for error details
- Contact the development team 