import request from 'supertest';
import { createApp } from '../src/app.js';

describe('app routes', () => {
  const app = createApp();

  it('serves health checks', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('lists feature metadata', async () => {
    const response = await request(app).get('/api/features');

    expect(response.status).toBe(200);
    expect(response.body.features.length).toBeGreaterThan(0);
    expect(response.body.features[0]).toHaveProperty('key');
  });

  it('protects project generation', async () => {
    const response = await request(app)
      .post('/api/generate')
      .send({ projectName: 'Protected API' });

    expect(response.status).toBe(401);
  });
});
