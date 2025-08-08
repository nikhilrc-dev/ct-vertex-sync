require('dotenv').config();
const https = require('https');

async function testDeltaSync() {
  try {
    console.log('🧪 Testing delta sync with corrected event...');
    
    // Test event with correct product ID and environment
    const testEvent = {
      "specversion": "1.0",
      "id": "test-event-id-2025-08-08",
      "type": "com.commercetools.product.message.ProductCreated",
      "source": "/whitecap-us/products/0ec07d4c-adc5-4327-b723-0893a114ca5b",
      "subject": "ProductCreated",
      "time": "2025-08-08T10:30:00.000Z",
      "data": {
        "notificationType": "Message",
        "projectKey": "whitecap-us",
        "type": "ProductCreated",
        "resource": {
          "typeId": "product",
          "id": "0ec07d4c-adc5-4327-b723-0893a114ca5b"
        }
      }
    };
    
    console.log('📦 Test event data:');
    console.log(JSON.stringify(testEvent, null, 2));
    
    // If you have a local incremental updater running, you can test it
    // Replace with your actual endpoint URL when deployed
    const endpointUrl = process.env.DELTA_SYNC_URL || 'http://localhost:3001/deltaSync';
    
    console.log(`\n📤 Sending test event to: ${endpointUrl}`);
    
    // Send the test event
    const postData = JSON.stringify(testEvent);
    
    const options = {
      hostname: new URL(endpointUrl).hostname,
      port: new URL(endpointUrl).port || 443,
      path: new URL(endpointUrl).pathname,
      method: 'POST',
      headers: {
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
        console.log(`\n✅ Response received:`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, data);
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDeltaSync(); 