const request = require('supertest');
const app = require('../src/index');

describe('Incremental Updater Application', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('storeKey');
    });
  });

  describe('POST /deltaSync', () => {
    it('should handle delta sync request', async () => {
      const message = {
        type: 'ProductCreated',
        resourceTypeId: 'product',
        resourceId: 'test-product-id',
        version: 1
      };

      const response = await request(app)
        .post('/deltaSync')
        .send(message)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /sync/:productId', () => {
    it('should handle manual sync request', async () => {
      const response = await request(app)
        .post('/sync/test-product-id')
        .send({ action: 'upsert' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
    });
  });
}); 