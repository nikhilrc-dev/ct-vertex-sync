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

async function testRealProductSimple() {
  try {
    console.log('Testing real product import from Commercetools to Vertex AI...');
    
    // Initialize Vertex service
    const vertexService = new VertexService(process.env.VERTEX_CONFIG);
    console.log('✅ Vertex service initialized');
    
    // Get a real product from Commercetools
    console.log('\n📦 Fetching a real product from Commercetools...');
    
    const accessToken = await getAccessToken();
    console.log('✅ Got access token');
    
    // Fetch products
    const productsResponse = await fetchWithToken(accessToken, '/products?limit=1');
    
    if (!productsResponse.results || productsResponse.results.length === 0) {
      console.log('❌ No products found in Commercetools');
      return;
    }
    
    const realProduct = productsResponse.results[0];
    console.log('✅ Real product fetched:');
    console.log('- ID:', realProduct.id);
    console.log('- Name:', realProduct.masterData?.current?.name?.['en-US'] || 'No name');
    console.log('- SKU:', realProduct.masterData?.current?.variants?.[0]?.sku || 'No SKU');
    
    // Transform the real product
    console.log('\n🔄 Transforming real product...');
    const retailProduct = vertexService.transformToRetailProduct(realProduct);
    console.log('✅ Real product transformed successfully');
    console.log('Transformed product:', JSON.stringify(retailProduct, null, 2));
    
    // Import the real product
    console.log('\n📤 Importing real product to Vertex AI...');
    try {
      const result = await vertexService.importProduct(realProduct);
      console.log('✅ Real product import successful!');
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Real product import failed:');
      console.log('Error:', error.message);
      
      if (error.message.includes('403')) {
        console.log('\n💡 This is a permissions issue. You need to:');
        console.log('1. Go to Google Cloud Console');
        console.log('2. Switch to the gwa-vertex project');
        console.log('3. Go to IAM & Admin → IAM');
        console.log('4. Grant "Retail Admin" role to: vertex-ai-search@whitecap-us.iam.gserviceaccount.com');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealProductSimple(); 