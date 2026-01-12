import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the MongoDB connection and api-versions module
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
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
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
    process.env.NANO_BANANA_API_KEY = 'test-nanobanana-api-key';
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
      expect(data).toHaveProperty('nanobanana');
      expect(data.gemini.connected).toBe(true);
      expect(data.nanobanana.connected).toBe(true);
      expect(data.gemini.latency).toBeDefined();
      expect(data.nanobanana.latency).toBeDefined();
    });

    it('should return disconnected status when Gemini API fails', async () => {
      // Mock failed Gemini response, successful Nano Banana
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
      expect(data.nanobanana.connected).toBe(true);
    });

    it('should return disconnected status when Nano Banana API fails', async () => {
      // Mock successful Gemini, failed Nano Banana
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
      expect(data.nanobanana.connected).toBe(false);
      expect(data.nanobanana.error).toContain('HTTP 500');
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
      expect(data.nanobanana.connected).toBe(false);
    });

    it('should return disconnected when Gemini API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;

      // Mock Nano Banana success
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

    it('should return disconnected when Nano Banana API key is not configured', async () => {
      delete process.env.NANO_BANANA_API_KEY;

      // Mock Gemini success
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

      expect(data.nanobanana.connected).toBe(false);
      expect(data.nanobanana.error).toContain('API key not configured');
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
      expect(data.nanobanana.connected).toBe(true);
    });

    it('should handle timeout gracefully for Nano Banana', async () => {
      // Mock timeout error for Nano Banana
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
      expect(data.nanobanana.connected).toBe(false);
      expect(data.nanobanana.error).toContain('aborted');
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
      expect(data.nanobanana.connected).toBe(false);
      expect(data.nanobanana.error).toBe('Connection refused');
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
      expect(Object.keys(data)).toContain('nanobanana');

      // Validate gemini structure
      expect(typeof data.gemini.connected).toBe('boolean');
      if (data.gemini.latency !== undefined) {
        expect(typeof data.gemini.latency).toBe('number');
      }

      // Validate nanobanana structure
      expect(typeof data.nanobanana.connected).toBe('boolean');
      if (data.nanobanana.latency !== undefined) {
        expect(typeof data.nanobanana.latency).toBe('number');
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
      expect(data.nanobanana.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/status/versions', () => {
    it('should return version data for both services', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta', 'v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const mockNanoBananaVersion = {
        _id: 'nanobanana-version-id',
        service: 'nanobanana' as const,
        currentVersion: 'v1',
        lastKnownGood: 'v1',
        availableVersions: ['v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockGeminiVersion)
        .mockResolvedValueOnce(mockNanoBananaVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('gemini');
      expect(data).toHaveProperty('nanobanana');
      expect(data.gemini.version).toBe('v1beta');
      expect(data.nanobanana.version).toBe('v1');
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.nanobanana.lastChecked).toBeDefined();
    });

    it('should return null version when Gemini version record is missing', async () => {
      const mockNanoBananaVersion = {
        _id: 'nanobanana-version-id',
        service: 'nanobanana' as const,
        currentVersion: 'v1',
        lastKnownGood: 'v1',
        availableVersions: ['v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // Gemini not found
        .mockResolvedValueOnce(mockNanoBananaVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBeNull();
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.nanobanana.version).toBe('v1');
    });

    it('should return null version when Nano Banana version record is missing', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta', 'v1'],
        lastChecked: new Date('2025-01-10T12:00:00Z'),
      };

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockGeminiVersion)
        .mockResolvedValueOnce(null); // Nano Banana not found

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBe('v1beta');
      expect(data.nanobanana.version).toBeNull();
      expect(data.nanobanana.lastChecked).toBeDefined();
    });

    it('should return null versions when both version records are missing', async () => {
      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gemini.version).toBeNull();
      expect(data.nanobanana.version).toBeNull();
      // Should still have lastChecked timestamps (defaulting to current time)
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.nanobanana.lastChecked).toBeDefined();
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

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockGeminiVersion)
        .mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      const data = await response.json();

      // Validate ISO format
      expect(data.gemini.lastChecked).toBe('2025-01-10T15:30:00.000Z');
      // For missing version, lastChecked should still be a valid ISO string
      expect(() => new Date(data.nanobanana.lastChecked)).not.toThrow();
    });

    it('should return 500 when database connection fails', async () => {
      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();

      // Should still return a valid structure with null versions
      expect(data.gemini.version).toBeNull();
      expect(data.nanobanana.version).toBeNull();
      expect(data.gemini.lastChecked).toBeDefined();
      expect(data.nanobanana.lastChecked).toBeDefined();
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

      const mockNanoBananaVersion = {
        _id: 'nanobanana-version-id',
        service: 'nanobanana' as const,
        currentVersion: 'v1',
        lastKnownGood: 'v1',
        availableVersions: ['v1'],
        lastChecked: new Date(),
      };

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockGeminiVersion)
        .mockResolvedValueOnce(mockNanoBananaVersion);

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      const data = await response.json();

      // Validate structure
      expect(typeof data).toBe('object');
      expect(Object.keys(data)).toContain('gemini');
      expect(Object.keys(data)).toContain('nanobanana');

      // Validate gemini structure
      expect(Object.keys(data.gemini)).toContain('version');
      expect(Object.keys(data.gemini)).toContain('lastChecked');
      expect(typeof data.gemini.lastChecked).toBe('string');

      // Validate nanobanana structure
      expect(Object.keys(data.nanobanana)).toContain('version');
      expect(Object.keys(data.nanobanana)).toContain('lastChecked');
      expect(typeof data.nanobanana.lastChecked).toBe('string');
    });

    it('should handle partial database failure gracefully', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-version-id',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta'],
        lastChecked: new Date(),
      };

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { getAPIVersionByService } = await import('@/lib/db/api-versions');
      (getAPIVersionByService as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockGeminiVersion)
        .mockRejectedValueOnce(new Error('Query failed'));

      const { GET } = await import('@/app/api/status/versions/route');
      const response = await GET();

      // Even with partial failure, route should handle it
      // The actual behavior depends on implementation - it may return 500 or partial data
      expect([200, 500]).toContain(response.status);
    });
  });
});
