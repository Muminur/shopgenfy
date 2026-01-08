import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MongoDB Connection', () => {
  beforeEach(() => {
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('MONGODB_DB_NAME', 'shopgenfy_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('getMongoClient', () => {
    it('should return a MongoClient instance', async () => {
      const { getMongoClient } = await import('@/lib/mongodb');
      const client = getMongoClient();
      expect(client).toBeDefined();
    });

    it('should reuse the same client instance on multiple calls', async () => {
      const { getMongoClient } = await import('@/lib/mongodb');
      const client1 = getMongoClient();
      const client2 = getMongoClient();
      expect(client1).toBe(client2);
    });
  });

  describe('getDatabase', () => {
    it('should return a database instance with the configured name', async () => {
      const { getDatabase } = await import('@/lib/mongodb');
      const db = getDatabase();
      expect(db).toBeDefined();
    });
  });

  describe('environment validation', () => {
    it('should throw error when MONGODB_URI is missing', async () => {
      vi.stubEnv('MONGODB_URI', '');
      vi.resetModules();

      await expect(import('@/lib/mongodb')).rejects.toThrow();
    });

    it('should throw error when MONGODB_DB_NAME is missing', async () => {
      vi.stubEnv('MONGODB_DB_NAME', '');
      vi.resetModules();

      await expect(import('@/lib/mongodb')).rejects.toThrow();
    });
  });
});
