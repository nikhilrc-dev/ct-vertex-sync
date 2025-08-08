# Commercetools Connect Deployment Guide

## Prerequisites

1. **Commercetools API Client** with the following scopes:
   - `manage_project:your-project-key`
   - `manage_subscriptions:your-project-key`
   - `view_products:your-project-key`
   - `manage_products:your-project-key`

2. **Google Cloud Service Account Key** (`vertex-key.json`) with `retail.admin` role

3. **Docker** installed and running (for bundling)

## Step 1: Prepare Your Credentials

Create a `.env` file in the root directory with your actual credentials:

```bash
# Commercetools Configuration
CTP_PROJECT_KEY=your-actual-project-key
CTP_CLIENT_ID=your-actual-client-id
CTP_CLIENT_SECRET=your-actual-client-secret
CTP_SCOPE=manage_products:view_products:manage_stores:view_stores
CTP_REGION=gcp-europe-west1

# Store Configuration (for incremental updater)
CTP_STORE_KEY=your-actual-store-key

# Vertex AI Configuration (JSON string)
VERTEX_CONFIG={"PROJECT_ID":"whitecap-us","LOCATION":"global","CATALOG_ID":"default_catalog","BRANCH_ID":"0","KEY_FILE_PATH":"vertex-key.json"}
```

## Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install full-export dependencies
cd full-export && npm install && cd ..

# Install incremental-updater dependencies
cd incremental-updater && npm install && cd ..
```

## Step 3: Authenticate with Commercetools

```bash
npx @commercetools/cli auth login \
  --client-credentials \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET \
  --project-key YOUR_PROJECT_KEY \
  --region gcp-europe-west1
```

## Step 4: Bundle Applications

```bash
npx @commercetools/cli connect bundle
```

## Step 5: Deploy Applications

```bash
npx @commercetools/cli connect deployment create
```

## Step 6: Verify Deployment

1. **Check deployment status**:
   ```bash
   npx @commercetools/cli connect deployment list
   ```

2. **View logs**:
   ```bash
   npx @commercetools/cli connect deployment logs --deployment-id YOUR_DEPLOYMENT_ID
   ```

## Step 7: Test Endpoints

Once deployed, you can access:

### Full Sync
```bash
curl -X POST https://your-app-url.commercetools.com/fullSync
```

### Health Check
```bash
curl https://your-app-url.commercetools.com/health
```

### Delta Sync (automatic)
The delta sync endpoint will be automatically triggered by Commercetools events.

## Troubleshooting

### Docker Issues on Windows
If you encounter Docker volume path issues, try:
1. Use WSL2 for Docker
2. Or use a Linux/macOS environment

### Authentication Issues
1. Verify your API client has the correct scopes
2. Check that your project key is correct
3. Ensure your region matches your Commercetools project

### Bundling Issues
1. Make sure Docker is running
2. Check that all dependencies are installed
3. Verify the `connect.yaml` configuration

## Post-Deployment

After successful deployment:

1. **Subscriptions will be automatically created** for:
   - Product events (create, update, delete)
   - Store events
   - Product selection events

2. **Full sync can be triggered manually** via the `/fullSync` endpoint

3. **Delta sync will work automatically** for real-time updates

## Monitoring

- **Health checks**: Use `/health` endpoint
- **Logs**: Available via Connect CLI
- **Metrics**: Monitor via Commercetools Connect dashboard

## Support

If you encounter issues:
1. Check the logs for error details
2. Verify all credentials are correct
3. Ensure Docker is properly configured
4. Contact the development team 