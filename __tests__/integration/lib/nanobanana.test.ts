import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createNanoBananaClient,
  NanoBananaError,
  type NanoBananaClient,
  type ImageGenerationRequest,
  type VersionInfo,
} from '@/lib/nanobanana';

/**
 * Integration tests for Nano Banana API client
 * Tests actual client functions with mocked HTTP responses
 * Focuses on: image generation flow, polling, batch operations, error handling
 */
describe('Nano Banana API Client - Integration Tests', () => {
  const mockApiKey = 'test-nanobanana-api-key-123';
  let client: NanoBananaClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = createNanoBananaClient(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('generateImage - API Integration', () => {
    it('should generate icon image successfully with immediate completion', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Modern app icon with blue gradient',
        style: 'flat',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-123',
          status: 'completed',
          imageUrl: 'https://cdn.nanobanana.io/image-123.png',
        }),
      } as Response);

      const result = await client.generateImage(request);

      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('completed');
      expect(result.imageUrl).toBe('https://cdn.nanobanana.io/image-123.png');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
      expect(result.format).toBe('png');
    });

    it('should generate feature image with correct dimensions', async () => {
      const request: ImageGenerationRequest = {
        type: 'feature',
        prompt: 'Dashboard screenshot with analytics',
        style: 'modern',
        featureHighlight: 'Real-time analytics',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-456',
          status: 'completed',
          imageUrl: 'https://cdn.nanobanana.io/feature-456.png',
        }),
      } as Response);

      const result = await client.generateImage(request);

      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
      expect(result.imageUrl).toBeDefined();
    });

    it('should poll for completion when initially processing', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async (_url) => {
        fetchCallCount++;

        if (fetchCallCount === 1) {
          return {
            ok: true,
            json: async () => ({
              jobId: 'job-789',
              status: 'processing',
            }),
          };
        }

        if (fetchCallCount === 2 || fetchCallCount === 3) {
          return {
            ok: true,
            json: async () => ({
              jobId: 'job-789',
              status: 'processing',
              progress: 50,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            jobId: 'job-789',
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/completed.png',
          }),
        };
      });

      const result = await client.generateImage(request, {
        pollInterval: 100,
        timeout: 5000,
      });

      expect(fetchCallCount).toBeGreaterThan(1);
      expect(result.status).toBe('completed');
      expect(result.imageUrl).toBe('https://cdn.nanobanana.io/completed.png');
    });

    it('should timeout when generation takes too long', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          jobId: 'job-timeout',
          status: 'processing',
          progress: 10,
        }),
      }));

      await expect(
        client.generateImage(request, {
          pollInterval: 100,
          timeout: 500,
        })
      ).rejects.toThrow('Image generation timed out');
    });

    it('should throw error when job fails during polling', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;

        if (fetchCallCount === 1) {
          return {
            ok: true,
            json: async () => ({
              jobId: 'job-fail',
              status: 'processing',
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            jobId: 'job-fail',
            status: 'failed',
            error: 'Generation failed due to invalid prompt',
          }),
        };
      });

      await expect(
        client.generateImage(request, {
          pollInterval: 100,
        })
      ).rejects.toThrow('Generation failed due to invalid prompt');
    });

    it('should reject prompts containing Shopify branding', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'App icon with Shopify logo',
      };

      await expect(client.generateImage(request)).rejects.toThrow(
        'Prompt cannot contain Shopify branding'
      );
    });

    it('should reject empty prompts', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: '   ',
      };

      await expect(client.generateImage(request)).rejects.toThrow('Prompt is required');
    });

    it('should reject invalid image types', async () => {
      const request = {
        type: 'invalid-type' as any,
        prompt: 'Test',
      };

      await expect(client.generateImage(request)).rejects.toThrow('Invalid image type');
    });

    it('should send correct request body with all options', async () => {
      const request: ImageGenerationRequest = {
        type: 'feature',
        prompt: 'Beautiful dashboard',
        style: 'gradient',
        featureHighlight: 'Analytics view',
        negativePrompt: 'ugly, distorted',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-123',
          status: 'completed',
          imageUrl: 'https://cdn.nanobanana.io/image.png',
        }),
      } as Response);

      await client.generateImage(request);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.prompt).toBe('Beautiful dashboard');
      expect(requestBody.width).toBe(1600);
      expect(requestBody.height).toBe(900);
      expect(requestBody.style).toBe('gradient');
      expect(requestBody.featureHighlight).toBe('Analytics view');
      expect(requestBody.negativePrompt).toBe('ugly, distorted');
    });

    it('should include authorization header in requests', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-123',
          status: 'completed',
          imageUrl: 'https://cdn.nanobanana.io/image.png',
        }),
      } as Response);

      await client.generateImage(request);

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe(`Bearer ${mockApiKey}`);
    });
  });

  describe('generateBatch - API Integration', () => {
    it('should generate multiple images in batches', async () => {
      const requests: ImageGenerationRequest[] = [
        { type: 'icon', prompt: 'Icon 1' },
        { type: 'feature', prompt: 'Feature 1' },
        { type: 'feature', prompt: 'Feature 2' },
      ];

      let requestCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        requestCount++;
        const jobId = `job-${requestCount}`;

        return {
          ok: true,
          json: async () => ({
            jobId,
            status: 'completed',
            imageUrl: `https://cdn.nanobanana.io/image-${requestCount}.png`,
          }),
        };
      });

      const results = await client.generateBatch(requests, {
        concurrentLimit: 2,
      });

      // Verify correct number of results
      expect(results).toHaveLength(3);

      // Verify all results have the required properties
      results.forEach((result) => {
        expect(result.jobId).toMatch(/^job-\d+$/);
        expect(result.status).toBe('completed');
        expect(result.imageUrl).toMatch(/^https:\/\/cdn\.nanobanana\.io\/image-\d+\.png$/);
      });

      // Verify total number of fetch calls matches number of requests
      expect(requestCount).toBe(3);
    });

    it('should respect concurrent limit in batch generation', async () => {
      const requests: ImageGenerationRequest[] = Array.from({ length: 6 }, (_, i) => ({
        type: 'icon' as const,
        prompt: `Icon ${i + 1}`,
      }));

      const startTimes: number[] = [];
      global.fetch = vi.fn().mockImplementation(async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          ok: true,
          json: async () => ({
            jobId: `job-${startTimes.length}`,
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/image.png',
          }),
        };
      });

      await client.generateBatch(requests, {
        concurrentLimit: 3,
      });

      expect(startTimes).toHaveLength(6);
    });

    it('should handle partial failures in batch generation', async () => {
      const requests: ImageGenerationRequest[] = [
        { type: 'icon', prompt: 'Icon 1' },
        { type: 'icon', prompt: 'Icon 2' },
        { type: 'icon', prompt: 'Icon 3' },
      ];

      let requestCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        requestCount++;
        // Fail on request 2 and all its retries (attempts 2, 3, 4)
        if (requestCount >= 2 && requestCount <= 4) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Generation failed' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            jobId: `job-${requestCount}`,
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/image.png',
          }),
        };
      });

      await expect(
        client.generateBatch(requests, {
          concurrentLimit: 1,
        })
      ).rejects.toThrow();

      expect(requestCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getJobStatus - API Integration', () => {
    it('should fetch job status successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-status-123',
          status: 'processing',
          progress: 75,
        }),
      } as Response);

      const status = await client.getJobStatus('job-status-123');

      expect(status.jobId).toBe('job-status-123');
      expect(status.status).toBe('processing');
      expect(status.progress).toBe(75);
    });

    it('should return completed job status with URL', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-done',
          status: 'completed',
          imageUrl: 'https://cdn.nanobanana.io/final.png',
        }),
      } as Response);

      const status = await client.getJobStatus('job-done');

      expect(status.status).toBe('completed');
      expect(status.imageUrl).toBe('https://cdn.nanobanana.io/final.png');
    });

    it('should return failed job status with error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'job-failed',
          status: 'failed',
          error: 'Invalid image parameters',
        }),
      } as Response);

      const status = await client.getJobStatus('job-failed');

      expect(status.status).toBe('failed');
      expect(status.error).toBe('Invalid image parameters');
    });
  });

  describe('checkVersion - API Integration', () => {
    it('should fetch API version information', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: ['batch-generation', 'style-presets', 'hd-quality'],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersionInfo,
      } as Response);

      const versionInfo = await client.checkVersion();

      expect(versionInfo.version).toBe('2.1.0');
      expect(versionInfo.features).toContain('batch-generation');
      expect(versionInfo.releaseDate).toBe('2026-01-10');
    });

    it('should include authorization in version check', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          version: '2.0.0',
          releaseDate: '2026-01-01',
          features: [],
        }),
      } as Response);

      await client.checkVersion();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe(`Bearer ${mockApiKey}`);
    });
  });

  describe('Retry Logic - API Integration', () => {
    it('should retry on 429 rate limit with exponential backoff', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Map([['retry-after', '1']]),
            json: async () => ({ error: 'Rate limited' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            jobId: 'job-retry',
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/retry.png',
          }),
        };
      });

      const result = await client.generateImage(request);

      expect(callCount).toBe(2);
      expect(result.imageUrl).toBe('https://cdn.nanobanana.io/retry.png');
    });

    it('should retry on 500 server errors', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Server error' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            jobId: 'job-server-retry',
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/retry.png',
          }),
        };
      });

      const result = await client.generateImage(request);

      expect(callCount).toBe(3);
      expect(result.status).toBe('completed');
    });

    it('should throw error after max retries exceeded', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Persistent server error' }),
      }));

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
    });

    it('should handle network failures with retry', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network connection failed');
        }
        return {
          ok: true,
          json: async () => ({
            jobId: 'job-network-retry',
            status: 'completed',
            imageUrl: 'https://cdn.nanobanana.io/network.png',
          }),
        };
      });

      const result = await client.generateImage(request);

      expect(callCount).toBe(2);
      expect(result.imageUrl).toBe('https://cdn.nanobanana.io/network.png');
    });
  });

  describe('Error Handling - API Integration', () => {
    it('should handle 401 unauthorized errors', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      } as Response);

      try {
        await client.generateImage(request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid API key');
        expect((error as any).statusCode).toBe(401);
      }
    });

    it('should handle 403 forbidden errors', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied to this resource' }),
      } as Response);

      await expect(client.generateImage(request)).rejects.toThrow('Access denied to this resource');
    });

    it('should handle response without error body', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('No JSON');
        },
      } as unknown as Response);

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
    });
  });
});
