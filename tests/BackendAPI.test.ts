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
