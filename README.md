# Commercetools to Vertex AI Product Synchronization

Enterprise-grade product data synchronization between Commercetools e-commerce platform and Google Cloud Vertex AI Search for Commerce.

## Overview

This application provides seamless integration between Commercetools product catalog and Google Cloud Vertex AI, enabling advanced AI-powered search capabilities, intelligent product recommendations, and enhanced customer experience through machine learning.

## Business Value

- **Enhanced Search Experience**: AI-powered product search with semantic understanding
- **Intelligent Recommendations**: Personalized product suggestions based on user behavior
- **Real-time Data Synchronization**: Maintain product catalog consistency across platforms
- **Scalable Architecture**: Handle large product catalogs with optimal performance
- **Enterprise Integration**: Seamless integration with existing e-commerce infrastructure

## Architecture

### Service Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Commercetools │    │   Sync Services  │    │   Vertex AI     │
│                 │    │                  │    │                 │
│ • Product Catalog│───▶│ • Full Export    │───▶│ • Search API    │
│ • Inventory     │    │ • Incremental    │    │ • Retail API    │
│ • Categories    │    │   Updates        │    │ • ML Models     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Service Architecture

| Service | Purpose | Trigger | Scope |
|---------|---------|---------|-------|
| **Full Export** | Complete catalog synchronization | Manual/Scheduled | All products |
| **Incremental Updater** | Real-time updates | Event-driven | Individual products |

## Technical Implementation

### Data Integration Strategy

- **Hybrid API Approach**: Combines GraphQL for product data and REST for availability
- **Optimized Queries**: Reduced complexity to meet API limitations
- **Batch Processing**: Efficient handling of large datasets
- **Real-time Events**: Event-driven architecture for immediate updates

### Data Transformation

Products are transformed from Commercetools format to Vertex AI Retail API format:

```json
{
  "id": "product-uuid",
  "title": "Product Name",
  "description": "Product Description",
  "categories": ["Category Name"],
  "availableQuantity": 100,
  "availability": "IN_STOCK",
  "priceInfo": {
    "currencyCode": "USD",
    "price": 99.99,
    "originalPrice": 129.99
  },
  "attributes": {
    "sku": { "text": ["SKU123"] },
    "product_type": { "text": ["Product Type"] },
    "ctp_region": { "text": ["us-central1"] }
  }
}
```

## Installation & Configuration

### Prerequisites

- Node.js 16 or higher
- Commercetools account with API access
- Google Cloud project with Vertex AI enabled
- Service account with appropriate permissions

### Environment Configuration

```bash
# Commercetools Configuration
CTP_PROJECT_KEY=your-project-key
CTP_CLIENT_ID=your-client-id
CTP_CLIENT_SECRET=your-client-secret
CTP_SCOPE=your-scope
CTP_REGION=your-region
CTP_STORE_KEY=your-store-key

# Vertex AI Configuration
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=your-location
VERTEX_CATALOG_ID=your-catalog-id
VERTEX_BRANCH_ID=your-branch-id

# Service Account Credentials (25 accounts for different operations)
VERTEX_SA_EMAIL_1=your-service-account-email
VERTEX_SA_PRIVATE_KEY_1=your-private-key
# ... additional service accounts

# Application Configuration
PRODUCT_BASE_URL=https://your-store.com
PORT=3000
```

### Deployment

```bash
# Install dependencies
cd full-export && npm install
cd ../incremental-updater && npm install

# Start services
cd ../full-export && npm start
cd ../incremental-updater && npm start
```

## API Reference

### Full Export Service

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/full-sync` | POST | Trigger complete product synchronization |
| `/api/product-counts` | GET | Retrieve product count statistics |
| `/api/sync-product` | POST | Synchronize individual product |

### Incremental Updater Service

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook` | POST | Handle Commercetools webhook events |
| `/api/health` | GET | Service health check |

## Event Handling

The application processes various Commercetools events:

| Event Type | Action | Description |
|------------|--------|-------------|
| `ProductCreated` | Create | Add new product to Vertex AI |
| `ProductPublished` | Update | Publish product in Vertex AI |
| `ProductDeleted` | Delete | Remove product from Vertex AI |
| `ProductUnpublished` | Delete | Unpublish product from Vertex AI |
| `ProductPriceChanged` | Update | Update product pricing |
| `ProductVariantAdded` | Update | Add product variant |

## Monitoring & Observability

### Logging Structure

```
📥 Full Sync: Fetched 500 products from commercetools
🔄 Full Sync: Importing 500 products to Vertex AI
📋 VERTEX AI FULL SYNC PAYLOAD:
Total Products: 500
Sample Product: { id: "abc123", title: "Product Name", ... }
--- COMPLETE VERTEX AI PAYLOAD ---
[{ complete payload }]
--- END VERTEX AI PAYLOAD ---
✅ Full Sync: Successfully imported 500 products to Vertex AI
✅ Full Sync: Completed in 15000ms - 500 products processed, 0 errors
```

### Performance Metrics

- **Batch Size**: 50 products per batch
- **Processing Rate**: 1-second delay between batches
- **Error Handling**: Comprehensive retry logic
- **Memory Usage**: Optimized for large datasets

## Project Structure

```
connect-app/
├── full-export/
│   ├── src/
│   │   ├── services/
│   │   │   ├── hybrid-service.js      # GraphQL + REST integration
│   │   │   ├── vertex-service.js      # Vertex AI integration
│   │   │   └── product-export-service.js
│   │   └── index.js
│   └── package.json
├── incremental-updater/
│   ├── src/
│   │   ├── services/
│   │   │   ├── hybrid-service.js      # GraphQL + REST integration
│   │   │   ├── vertex-service.js      # Vertex AI integration
│   │   │   └── product-sync-service.js
│   │   └── handlers/
│   │       └── message-handler.js     # Event processing
│   └── package.json
├── connect.yaml                       # Deployment configuration
└── README.md
```

## Security

- **Authentication**: OAuth 2.0 with Commercetools
- **Authorization**: Service account-based access to Vertex AI
- **Data Protection**: Environment variable-based configuration
- **Transport Security**: HTTPS for all API communications

## Performance Optimization

- **Query Complexity Management**: Optimized GraphQL queries to stay within limits
- **Batch Processing**: Efficient handling of large product catalogs
- **Rate Limiting**: Respectful API usage patterns
- **Caching Strategy**: Optimized data fetching and transformation

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify Commercetools credentials and scopes
   - Check Vertex AI service account permissions
   - Ensure environment variables are correctly set

2. **Product Sync Failures**
   - Review API rate limits and quotas
   - Check network connectivity
   - Verify data format compliance

3. **Performance Issues**
   - Monitor batch processing times
   - Check memory usage patterns
   - Review query complexity metrics

### Support

For technical support and issues:
- Review application logs for detailed error information
- Verify configuration parameters
- Check API documentation for both platforms
- Contact the development team for assistance

## License

This project is licensed under the MIT License.

---

**Built with Node.js, Express, and Google Cloud Vertex AI** 