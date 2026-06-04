import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { vi } from 'vitest';

Object.assign(global, { TextDecoder, TextEncoder });

// Mock global fetch to handle relative URLs in tests gracefully
global.fetch = vi.fn().mockImplementation((url) => {
  if (url === '/api/voices') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response);
});
