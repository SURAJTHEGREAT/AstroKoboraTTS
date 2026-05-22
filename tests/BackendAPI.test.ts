// @vitest-environment node
import request from 'supertest';
import { app, initDb } from '../server';
import fs from 'fs/promises';
import path from 'path';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await initDb();
});

describe('Backend API Mode Tests', () => {
  it('POST /api/train should train a custom voice sample successfully', async () => {
    const dummyFilePath = path.join(__dirname, 'dummy_sample.wav');
    await fs.writeFile(dummyFilePath, 'dummy audio data');

    const response = await request(app)
      .post('/api/train')
      .field('username', 'admin')
      .field('password', 'password')
      .field('voiceName', 'test_custom_voice')
      .attach('sample', dummyFilePath);

    await fs.unlink(dummyFilePath);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Voice embedding trained successfully');
    expect(response.body).toHaveProperty('voiceName', 'test_custom_voice');
  });

  it('POST /api/clients should fail with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/clients')
      .send({ username: 'admin', password: 'wrongpassword', clientName: 'Test Client' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('API_ONLY mode authentication flow', async () => {
    // 1. Create a client with valid credentials
    const createRes = await request(app)
      .post('/api/clients')
      .send({ username: 'admin', password: 'password', clientName: 'Test Auth Client' });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);

    const { client_id, client_secret } = createRes.body.client;
    expect(client_id).toBeDefined();
    expect(client_secret).toBeDefined();

    // Enable API_ONLY mode
    const originalApiOnly = process.env.API_ONLY;
    process.env.API_ONLY = 'true';

    try {
      // 2. Try to access /api/voices without credentials (should fail)
      const failRes1 = await request(app).get('/api/voices');
      expect(failRes1.status).toBe(401);
      expect(failRes1.body.error).toBe('Missing x-client-id or x-client-secret headers');

      // 3. Try to access with invalid credentials (should fail)
      const failRes2 = await request(app)
        .get('/api/voices')
        .set('x-client-id', client_id)
        .set('x-client-secret', 'wrong_secret');
      expect(failRes2.status).toBe(401);
      expect(failRes2.body.error).toBe('Invalid client credentials');

      // 4. Try to access with valid credentials (should succeed)
      const successRes = await request(app)
        .get('/api/voices')
        .set('x-client-id', client_id)
        .set('x-client-secret', client_secret);
      expect(successRes.status).toBe(200);
      expect(Array.isArray(successRes.body)).toBe(true);

      // 5. Try accessing /api/tts with valid credentials (should succeed/stream)
      const ttsRes = await request(app)
        .post('/api/tts')
        .set('x-client-id', client_id)
        .set('x-client-secret', client_secret)
        .send({ message: 'API test', voice: 'af_heart' });
      expect(ttsRes.status).toBe(200);
      expect(ttsRes.headers['content-type']).toMatch(/text\/event-stream/);
    } finally {
      // Restore API_ONLY mode
      process.env.API_ONLY = originalApiOnly;
    }
  });

  it('POST /api/train should fail with invalid credentials', async () => {
    const dummyFilePath = path.join(__dirname, 'dummy_sample2.wav');
    await fs.writeFile(dummyFilePath, 'dummy audio data');

    const response = await request(app)
      .post('/api/train')
      .field('username', 'admin')
      .field('password', 'wrong')
      .field('voiceName', 'test_custom_voice2')
      .attach('sample', dummyFilePath);

    await fs.unlink(dummyFilePath);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('POST /api/tts should handle custom voice and stream SSE', async () => {
    const responseText = await new Promise<string>((resolve, reject) => {
      let accumulatedData = '';

      const req = request(app)
        .post('/api/tts')
        .send({ message: 'Hello custom voice.', voice: 'test_custom_voice' })
        .set('Accept', 'text/event-stream')
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);

      req.buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            const data = chunk.toString();
            accumulatedData += data;

            if (data.includes('"status":"done"')) {
              resolve(accumulatedData);
            }
          });
          res.on('end', () => resolve(accumulatedData));
          res.on('error', (err) => reject(err));
        })
        .end((err) => {
          if (err) reject(err);
        });
    });

    expect(responseText).toContain('"status":"thinking"');
    expect(responseText).toContain('"status":"text"');
    expect(responseText).toContain('"status":"audio"');
    expect(responseText).toContain('"status":"done"');
  });
});
