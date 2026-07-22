import { describe, it, expect, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * The configured Mongo host is unreachable in this environment. The connection
 * layer must fail fast and, critically, NOT cache the rejected connect promise
 * forever — a later request (or a recovered DB) must be able to reconnect
 * without a process restart.
 */
describe('MongoDB connection resilience', () => {
  let mongoServer: MongoMemoryServer | undefined;

  afterAll(async () => {
    try {
      const mod = await import('@/lib/mongodb');
      await mod.closeDatabaseConnection();
    } catch {
      /* ignore */
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not poison the cached promise: recovers after a failed connect', async () => {
    vi.resetModules();
    vi.stubEnv('MONGODB_DB_NAME', 'shopgenfy_test');
    // Short server-selection window so the failing connect rejects quickly.
    vi.stubEnv('MONGODB_SERVER_SELECTION_TIMEOUT_MS', '300');
    // Nothing is listening on port 1 → the connect attempt rejects.
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:1/?directConnection=true');

    const { connectToDatabase } = await import('@/lib/mongodb');

    // First attempt: DB down → reject (fail fast, not a 30s hang).
    await expect(connectToDatabase()).rejects.toBeDefined();

    // Bring a real server online and repair the URI — the next call must retry
    // rather than replay the poisoned rejected promise.
    mongoServer = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongoServer.getUri());

    const client = await connectToDatabase();
    const db = client.db('shopgenfy_test');
    const ping = await db.command({ ping: 1 });
    expect(ping.ok).toBe(1);
  }, 30000);
});
