import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the MongoDB connection
vi.mock('@/lib/mongodb', () => ({
  getDatabaseConnected: vi.fn(),
}));

describe('Health Check API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Set up default environment variables using vi.stubEnv
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('MONGODB_DB_NAME', 'test_db');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when database is connected', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.status).toBe('healthy');
      expect(data.services.database).toBe('connected');
      expect(data.services.api).toBe('operational');
    });

    it('should return unhealthy status when database connection fails', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      expect(response.status).toBe(503);
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('disconnected');
    });

    it('should return unhealthy status when database ping fails', async () => {
      const mockDb = {
        command: vi.fn().mockRejectedValue(new Error('Ping failed')),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      expect(response.status).toBe(503);
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('disconnected');
    });

    it('should include timestamp in response', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      // Validate it's a valid ISO date string
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should include uptime in response', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include environment in response', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      expect(data.environment).toBeDefined();
      expect(data.environment).toBe('production');
    });

    it('should include version in response', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
    });

    it('should set no-cache headers', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    });

    it('should return proper JSON structure', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      // Validate required fields exist
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('services');
      expect(data.services).toHaveProperty('database');
      expect(data.services).toHaveProperty('api');
    });

    it('should return development environment when NODE_ENV is development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.resetModules();

      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      const data = await response.json();

      expect(data.environment).toBe('development');
    });
  });
});
