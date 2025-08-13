/**
 * Hybrid Service for commercetools - Uses GraphQL for most data, REST for availability
 * Combines the best of both APIs to get complete product information
 */

const https = require('https');

class HybridService {
  constructor() {
    this.apiHost = this.getApiHost();
    this.authHost = this.getAuthHost();
  }

  getApiHost() {
    switch (process.env.CTP_REGION) {
      case 'gcp-europe-west1':
      case 'europe-west1':
        return 'https://api.europe-west1.gcp.commercetools.com';
      case 'gcp-us-central1':
      case 'us-central1':
        return 'https://api.us-central1.gcp.commercetools.com';
      default:
        return 'https://api.commercetools.com';
    }
  }

  getAuthHost() {
    switch (process.env.CTP_REGION) {
      case 'gcp-europe-west1':
      case 'europe-west1':
        return 'https://auth.europe-west1.gcp.commercetools.com';
      case 'gcp-us-central1':
      case 'us-central1':
        return 'https://auth.us-central1.gcp.commercetools.com';
      default:
        return 'https://auth.commercetools.com';
    }
  }

  /**
   * Gets an access token from commercetools OAuth endpoint
   */
  async getAccessToken() {
    return new Promise((resolve, reject) => {
      // Validate required environment variables
      if (!process.env.CTP_CLIENT_ID || !process.env.CTP_CLIENT_SECRET || !process.env.CTP_PROJECT_KEY) {
        reject(new Error('Missing required environment variables: CTP_CLIENT_ID, CTP_CLIENT_SECRET, or CTP_PROJECT_KEY'));
        return;
      }
      
      const postData = `grant_type=client_credentials&scope=manage_project:${process.env.CTP_PROJECT_KEY}`;
      
      // Create proper Base64 encoding for Basic Auth
      const credentials = Buffer.from(`${process.env.CTP_CLIENT_ID}:${process.env.CTP_CLIENT_SECRET}`).toString('base64');
      
      const options = {
        hostname: this.authHost.replace('https://', ''),
        port: 443,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'Commercetools-Hybrid-Service/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const tokenData = JSON.parse(data);
              resolve(tokenData.access_token);
            } catch (parseError) {
              reject(new Error(`Failed to parse token response: ${parseError.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Executes a GraphQL query
   */
  async executeGraphQLQuery(query, variables = {}) {
    const accessToken = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        query,
        variables
      });
      
      const options = {
        hostname: this.apiHost.replace('https://', ''),
        port: 443,
        path: `/${process.env.CTP_PROJECT_KEY}/graphql`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            if (result.errors) {
              reject(new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`));
            } else {
              resolve(result.data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Gets product availability data from REST API
   */
  async getProductAvailability(productId) {
    const accessToken = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost.replace('https://', ''),
        port: 443,
        path: `/${process.env.CTP_PROJECT_KEY}/products/${productId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Commercetools-Hybrid-Service/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const productData = JSON.parse(data);
              resolve(productData);
            } catch (parseError) {
              reject(new Error(`Failed to parse product response: ${parseError.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Fetches all products with complete data (GraphQL + REST availability)
   */
  async fetchAllProducts() {
    try {
      // Get product data from GraphQL (minimal to reduce complexity)
      const graphqlQuery = `
        query GetProducts($limit: Int!, $offset: Int!) {
          products(limit: $limit, offset: $offset) {
            total
            results {
              id
              key
              version
              productType {
                name
              }
              masterData {
                current {
                  name(locale: "en-US")
                  description(locale: "en-US")
                  categories {
                    id
                    name(acceptLanguage: ["en-US", "en"])
                  }
                  masterVariant {
                    id
                    sku
                    prices {
                      value {
                        currencyCode
                        centAmount
                      }
                      discounted {
                        value {
                          currencyCode
                          centAmount
                        }
                      }
                    }
                    attributesRaw {
                      name
                      value
                    }
                  }
                  variants {
                    id
                    sku
                    prices {
                      value {
                        currencyCode
                        centAmount
                      }
                      discounted {
                        value {
                          currencyCode
                          centAmount
                        }
                      }
                    }
                    attributesRaw {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `;

             const products = [];
       let offset = 0;
       const limit = 100;

      while (true) {
        const result = await this.executeGraphQLQuery(graphqlQuery, { limit, offset });
        const batch = result.products.results;
        
        if (batch.length === 0) break;
        
        // For each product in the batch, get availability data from REST API
        const productsWithAvailability = await Promise.all(
          batch.map(async (product) => {
            try {
              const restProductData = await this.getProductAvailability(product.id);
              const mergedProduct = this.mergeProductData(product, restProductData);
              return this.transformProductDataWithExpansion(mergedProduct);
            } catch (error) {
              console.error(`❌ Failed to get availability for product ${product.id}:`, error.message);
              // Return product without availability data if REST API fails
              return this.transformProductDataWithExpansion(product);
            }
          })
        );
        
        products.push(...productsWithAvailability);

        if (batch.length < limit) break;
        offset += limit;
      }

      return products;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetches a single product with complete data (GraphQL + REST availability)
   */
  async fetchProductById(productId) {
    try {
      // Get product data from GraphQL (everything except availability)
      const graphqlQuery = `
        query GetProduct($id: String!) {
          product(id: $id) {
            id
            key
            version
            createdAt
            lastModifiedAt
            productType {
              name
            }
            masterData {
              current {
                name(locale: "en-US")
                description(locale: "en-US")
                categories {
                  id
                  name(acceptLanguage: ["en-US", "en"])
                  slug(acceptLanguage: ["en-US", "en"])
                }
                masterVariant {
                  id
                  sku
                  images {
                    url
                    dimensions {
                      width
                      height
                    }
                  }
                  prices {
                    id
                    value {
                      type
                      currencyCode
                      centAmount
                    }
                    discounted {
                      value {
                        type
                        currencyCode
                        centAmount
                      }
                    }
                  }
                  attributesRaw {
                    name
                    value
                  }
                }
                variants {
                  id
                  sku
                  images {
                    url
                    dimensions {
                      width
                      height
                    }
                  }
                  prices {
                    id
                    value {
                      type
                      currencyCode
                      centAmount
                    }
                    discounted {
                      value {
                        type
                        currencyCode
                        centAmount
                      }
                    }
                  }
                  attributesRaw {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const graphqlResult = await this.executeGraphQLQuery(graphqlQuery, { id: productId });
      if (!graphqlResult.product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Get availability data from REST API
      const restProductData = await this.getProductAvailability(productId);

      // Merge the data
      const mergedProduct = this.mergeProductData(graphqlResult.product, restProductData);
      
      return this.transformProductDataWithExpansion(mergedProduct);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Merges GraphQL and REST data
   */
  mergeProductData(graphqlProduct, restProduct) {
    const merged = { ...graphqlProduct };
    
    // Add availability data from REST API
    if (restProduct.masterData?.current?.masterVariant) {
      if (!merged.masterData.current.masterVariant) {
        merged.masterData.current.masterVariant = {};
      }
      merged.masterData.current.masterVariant.availability = restProduct.masterData.current.masterVariant.availability;
    }

    if (restProduct.masterData?.current?.variants) {
      if (!merged.masterData.current.variants) {
        merged.masterData.current.variants = [];
      }
      
      restProduct.masterData.current.variants.forEach((restVariant, index) => {
        if (merged.masterData.current.variants[index]) {
          merged.masterData.current.variants[index].availability = restVariant.availability;
        }
      });
    }

    return merged;
  }

  /**
   * Transforms GraphQL product data with expanded references to match expected format
   */
  transformProductDataWithExpansion(product) {
    const masterData = product.masterData?.current;
    
    if (!masterData) {
      throw new Error('Product has no master data');
    }

    // Transform categories using expanded data (names are already available)
    const categories = masterData.categories?.map(cat => {
      // Use the expanded category name directly
      if (cat.name) {
        return cat.name;
      } else if (cat.slug) {
        return cat.slug;
      } else {
        // Fallback to ID if no name or slug is available
        return cat.id;
      }
    }) || [];
    
         // Transform the product to match the expected format
     return {
       id: product.id,
       key: product.key,
       version: product.version,
       createdAt: new Date().toISOString(), // Default value since not fetched
       lastModifiedAt: new Date().toISOString(), // Default value since not fetched
       productType: product.productType?.name,
       masterData: {
         current: {
           name: masterData.name,
           description: masterData.description,
           categories: categories.map(name => ({ name })),
           masterVariant: this.transformVariant(masterData.masterVariant),
           variants: masterData.variants?.map(variant => this.transformVariant(variant)) || []
         }
       }
     };
  }

  /**
   * Transforms variant data
   */
  transformVariant(variant) {
    if (!variant) return null;

         return {
       id: variant.id,
       sku: variant.sku,
       images: variant.images?.map(img => ({
         url: img.url,
         dimensions: {
           w: img.dimensions?.width,
           h: img.dimensions?.height
         }
       })) || [],
       prices: variant.prices?.map(price => ({
         id: `price-${variant.id}-${Math.random()}`, // Generate ID since not fetched
         value: {
           type: 'centPrecision', // Default type since not fetched
           currencyCode: price.value.currencyCode,
           centAmount: price.value.centAmount
         },
         discounted: price.discounted ? {
           value: {
             type: 'centPrecision', // Default type since not fetched
             currencyCode: price.discounted.value.currencyCode,
             centAmount: price.discounted.value.centAmount
           }
         } : null
       })) || [],
       availability: variant.availability,
       attributes: variant.attributesRaw?.map(attr => ({
         name: attr.name,
         value: attr.value
       })) || []
     };
  }

  /**
   * Gets product counts using GraphQL
   */
  async getProductCounts() {
    const query = `
      query GetProductCounts {
        allProducts: products(limit: 1) {
          total
        }
        stagedProducts: products(limit: 1, where: "masterData(hasStagedChanges=true)") {
          total
        }
      }
    `;

    try {
      const result = await this.executeGraphQLQuery(query);
      const totalCount = result.allProducts.total;
      const stagedCount = result.stagedProducts.total;
      const publishedCount = totalCount - stagedCount;
      
      return {
        total: totalCount,
        published: publishedCount,
        staged: stagedCount,
        draft: 0
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test authentication and basic functionality
   */
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      
      const query = `
        query {
          products(limit: 1) {
            total
            results {
              id
            }
          }
        }
      `;
      
      const result = await this.executeGraphQLQuery(query);
      return { success: true, result };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { HybridService };
