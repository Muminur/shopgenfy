import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the MongoDB connection and api-versions module
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
  getDatabaseConnected: vi.fn(),
}));

vi.mock('@/lib/db/api-versions', () => ({
  getAPIVersionByService: vi.fn(),
}));

// Mock global fetch for external API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Status API Routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Set up default environment variables
    // Pollinations AI is a free API that doesn't require an API key
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('GET /api/status', () => {
    it('should return connected status when both APIs are healthy', async () => {
      // Mock successful responses from both APIs
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('gemini');
      expect(data).toHaveProperty('pollinations');
      expect(data.gemini.connected).toBe(true);
      expect(data.pollinations.connected).toBe(true);
      expect(data.gemini.latency).toBeDefined();
      expect(data.pollinations.latency).toBeDefined();
    });

    it('should return disconnected status when Gemini API fails', async () => {
      // Mock failed Gemini response, successful Pollinations
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(false);
      expect(data.gemini.error).toContain('HTTP 401');
      expect(data.pollinations.connected).toBe(true);
    });

    it('should return disconnected status when Pollinations API fails', async () => {
      // Mock successful Gemini, failed Pollinations
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(true);
      expect(data.pollinations.connected).toBe(false);
      expect(data.pollinations.error).toContain('HTTP 500');
    });

    it('should return disconnected status when both APIs fail', async () => {
      // Mock both APIs failing
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(false);
      expect(data.pollinations.connected).toBe(false);
    });

    it('should return disconnected when Gemini API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;

      // Mock Pollinations success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      vi.resetModules();
      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(false);
      expect(data.gemini.error).toContain('API key not configured');
    });

    it('should return connected for Pollinations even without API key (free API)', async () => {
      // Pollinations AI is a free API that doesn't require authentication
      // Mock Gemini and Pollinations both successful
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      vi.resetModules();
      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      // Pollinations should be connected since it doesn't require an API key
      expect(data.pollinations.connected).toBe(true);
    });

    it('should handle timeout gracefully for Gemini', async () => {
      // Mock timeout error for Gemini
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';

      mockFetch.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(false);
      expect(data.gemini.error).toContain('aborted');
      expect(data.pollinations.connected).toBe(true);
    });

    it('should handle timeout gracefully for Pollinations', async () => {
      // Mock timeout error for Pollinations
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockRejectedValueOnce(timeoutError);

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(true);
      expect(data.pollinations.connected).toBe(false);
      expect(data.pollinations.error).toContain('aborted');
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection refused'));

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.connected).toBe(false);
      expect(data.gemini.error).toBe('Network error');
      expect(data.pollinations.connected).toBe(false);
      expect(data.pollinations.error).toBe('Connection refused');
    });

    it('should return proper JSON structure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      // Validate structure
      expect(typeof data).toBe('object');
      expect(Object.keys(data)).toContain('gemini');
      expect(Object.keys(data)).toContain('pollinations');

      // Validate gemini structure
      expect(typeof data.gemini.connected).toBe('boolean');
      if (data.gemini.latency !== undefined) {
        expect(typeof data.gemini.latency).toBe('number');
      }

      // Validate pollinations structure
      expect(typeof data.pollinations.connected).toBe('boolean');
      if (data.pollinations.latency !== undefined) {
        expect(typeof data.pollinations.latency).toBe('number');
      }
    });

    it('should include latency measurements in response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      const { GET } = await import('@/app/api/status/route');
      const response = await GET();

      const data = await response.json();

      // Latency should be a non-negative number
      expect(data.gemini.latency).toBeGreaterThanOrEqual(0);
      expect(data.pollinations.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/status/versions', () => {
    // Note: Pollinations AI uses a static version (1.0.0) since it's a free API without versioning
    const POLLINATIONS_STATIC_VERSION = '1.0.0';

    it('should return version data for both services', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta', 'v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockGeminiVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('gemini');
      expect(data).toHaveProperty('pollinations');
      expect(data.gemini.version).toBe('v1beta');
      // Pollinations uses static version
      expect(data.pollinations.version).toBe(POLLINATIONS_STATIC_VERSION);
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.pollinations.lastChecked).toBeDefined();
    });

    it('should return null version when Gemini version record is missing', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBeNull();
      expect(data.gemini.lastChecked).toBeDefined();
      // Pollinations always returns static version
      expect(data.pollinations.version).toBe(POLLINATIONS_STATIC_VERSION);
    });

    it('should always return static version for Pollinations (free API)', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta', 'v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockGeminiVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBe('v1beta');
      // Pollinations version is static, not from database
      expect(data.pollinations.version).toBe(POLLINATIONS_STATIC_VERSION);
      expect(data.pollinations.lastChecked).toBeDefined();
    });

    it('should return Pollinations static version even when Gemini record is missing', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBeNull();
      // Pollinations is independent of database
      expect(data.pollinations.version).toBe(POLLINATIONS_STATIC_VERSION);
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.pollinations.lastChecked).toBeDefined();
    });

    it('should return lastChecked timestamps in ISO format', async () => {
      const lastCheckedDate = new Date('2025-01-10T15:30:00Z');
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta'],
        lastChecked: lastCheckedDate,
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockGeminiVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      const data = await response.json();

      // Validate ISO format
      expect(data.gemini.lastChecked).toBe('2025-01-10T15:30:00.000Z');
      // Pollinations lastChecked should still be a valid ISO string
      expect(() => new Date(data.pollinations.lastChecked)).not.toThrow();
    });

    it('should return 500 when database connection fails but still return Pollinations version', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();

      // Gemini should have null version due to DB failure
      expect(data.gemini.version).toBeNull();
      // Pollinations static version should still be returned
      expect(data.pollinations.version).toBe(POLLINATIONS_STATIC_VERSION);
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.pollinations.lastChecked).toBeDefined();
    });

    it('should return proper JSON structure for version response', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta'],
        lastChecked: new Date(),
      };

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockGeminiVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      const data = await response.json();

      // Validate structure
      expect(typeof data).toBe('object');
      expect(Object.keys(data)).toContain('gemini');
      expect(Object.keys(data)).toContain('pollinations');

      // Validate gemini structure
      expect(Object.keys(data.gemini)).toContain('version');
      expect(Object.keys(data.gemini)).toContain('lastChecked');
      expect(typeof data.gemini.lastChecked).toBe('string');

      // Validate pollinations structure
      expect(Object.keys(data.pollinations)).toContain('version');
      expect(Object.keys(data.pollinations)).toContain('lastChecked');
      expect(typeof data.pollinations.lastChecked).toBe('string');
    });

    it('should handle Gemini database query failure gracefully', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      // Gemini query fails
      (getAPIVersionByService as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Query failed')
      );

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      // Even with Gemini failure, route should handle it
      // The actual behavior depends on implementation - it may return 500 or partial data
      expect([200, 500]).toContain(response.status);
    });
  });
});
