// @vitest-environment node
import request from 'supertest';
import { app, initDb } from '../server';
import fs from 'fs/promises';
import path from 'path';

// Before all tests, initialize the DB and ensure models dir exists
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await initDb();
});

describe('Backend API Integration Tests', () => {
  it('GET /api/voices should return a list of voices', async () => {
    const response = await request(app).get('/api/voices');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  const testVoices = ['af_heart', 'am_adam', 'bf_emma'];

  for (const voice of testVoices) {
    it(`POST /api/tts should stream audio response for voice: ${voice}`, async () => {
      // Create a promise to wait for the final 'done' event from the SSE stream
      const responseText = await new Promise<string>((resolve, reject) => {
        let accumulatedData = '';

        const req = request(app)
          .post('/api/tts')
          .send({ message: 'Hello, this is a test.', voice })
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

      // Assert the stream contains expected events
      expect(responseText).toContain('"status":"thinking"');
      expect(responseText).toContain('"status":"text"');
      expect(responseText).toContain('"status":"audio"');
      expect(responseText).toContain('"status":"done"');
      expect(responseText).toContain('audioUrl');
    });
  }
});
