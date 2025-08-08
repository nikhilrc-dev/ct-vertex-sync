require('dotenv').config();
const { VertexService } = require('./full-export/src/services/vertex-service');
const https = require('https');

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = `grant_type=client_credentials&scope=manage_project:${process.env.CTP_PROJECT_KEY}`;
    
    const options = {
      hostname: 'auth.us-central1.gcp.commercetools.com',
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.CTP_CLIENT_ID + ':' + process.env.CTP_CLIENT_SECRET).toString('base64')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const tokenData = JSON.parse(data);
          resolve(tokenData.access_token);
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

async function fetchWithToken(accessToken, endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.us-central1.gcp.commercetools.com',
      port: 443,
      path: `/${process.env.CTP_PROJECT_KEY}${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
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
          resolve(result);
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

async function deleteProductsFromVertex() {
  try {
    console.log('Testing product deletion from Vertex AI...');
    
    // Initialize Vertex service
    const vertexService = new VertexService(process.env.VERTEX_CONFIG);
    console.log('✅ Vertex service initialized');
    
    // Get products from Commercetools to get their IDs
    console.log('\n📦 Fetching products from Commercetools to get IDs...');
    
    const accessToken = await getAccessToken();
    console.log('✅ Got access token');
    
    // Fetch ALL products from Commercetools
    console.log('📦 Fetching ALL products from Commercetools...');
    const products = [];
    let lastId = null;
    const limit = 500; // commercetools API limit

    while (true) {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        ...(lastId && { where: `id > "${lastId}"` })
      });

      const response = await fetchWithToken(accessToken, `/products?${queryParams}`);
      const batch = response.results;
      products.push(...batch);

      console.log(`📦 Fetched ${batch.length} products (total: ${products.length})`);

      // Check if we've reached the end
      if (batch.length < limit) {
        break;
      }

      lastId = batch[batch.length - 1].id;
    }
    
    if (products.length === 0) {
      console.log('❌ No products found in Commercetools');
      return;
    }
    console.log(`✅ Found ${products.length} products to delete`);
    
    // Delete each product from Vertex AI
    console.log('\n🗑️ Deleting products from Vertex AI...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productId = product.id;
      
      try {
        console.log(`\n🗑️ Deleting product ${i + 1}/${products.length}: ${productId}`);
        console.log(`   Name: ${product.masterData?.current?.name?.['en-US'] || 'No name'}`);
        
        const result = await vertexService.deleteProduct(productId);
        console.log(`   ✅ Successfully deleted product ${productId}`);
        successCount++;
        
        // Add a small delay between deletions
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to delete product ${productId}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Deletion Summary:');
    console.log(`   Total products: ${products.length}`);
    console.log(`   Successfully deleted: ${successCount}`);
    console.log(`   Failed to delete: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

deleteProductsFromVertex(); 