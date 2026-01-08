import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
  vi.stubEnv('MONGODB_DB_NAME', 'shopgenfy_test');
  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
  vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});
