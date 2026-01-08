import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NanoBananaClient,
  createNanoBananaClient,
  NanoBananaError,
  type ImageGenerationRequest,
  type GeneratedImageResult,
  type ImageType,
} from '@/lib/nanobanana';
import { IMAGE_SPECS } from '@/lib/validators/constants';

describe('NanoBananaClient', () => {
  const mockApiKey = 'test-api-key';
  let client: NanoBananaClient;

  beforeEach(() => {
    client = createNanoBananaClient(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNanoBananaClient', () => {
    it('should create a client with valid API key', () => {
      const client = createNanoBananaClient('valid-key');
      expect(client).toBeDefined();
      expect(client.generateImage).toBeDefined();
      expect(client.getJobStatus).toBeDefined();
      expect(client.checkVersion).toBeDefined();
    });

    it('should throw error for empty API key', () => {
      expect(() => createNanoBananaClient('')).toThrow(NanoBananaError);
      expect(() => createNanoBananaClient('')).toThrow('API key is required');
    });
  });

  describe('generateImage', () => {
    it('should generate an app icon with correct dimensions', async () => {
      const mockResult: GeneratedImageResult = {
        jobId: 'job-123',
        status: 'completed',
        imageUrl: 'https://cdn.nanobanana.io/images/icon-123.png',
        width: IMAGE_SPECS.ICON.width,
        height: IMAGE_SPECS.ICON.height,
        format: 'png',
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-123',
              status: 'processing',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'A modern app icon for a store management tool',
        style: 'flat',
      };

      const result = await client.generateImage(request);

      expect(result.width).toBe(IMAGE_SPECS.ICON.width);
      expect(result.height).toBe(IMAGE_SPECS.ICON.height);
      expect(result.imageUrl).toContain('nanobanana.io');
    });

    it('should generate a feature image with correct dimensions', async () => {
      const mockResult: GeneratedImageResult = {
        jobId: 'job-456',
        status: 'completed',
        imageUrl: 'https://cdn.nanobanana.io/images/feature-456.png',
        width: IMAGE_SPECS.FEATURE.width,
        height: IMAGE_SPECS.FEATURE.height,
        format: 'png',
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-456',
              status: 'processing',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult),
        });

      const request: ImageGenerationRequest = {
        type: 'feature',
        prompt: 'Dashboard showing analytics and charts',
        style: 'modern',
        featureHighlight: 'Analytics Dashboard',
      };

      const result = await client.generateImage(request);

      expect(result.width).toBe(IMAGE_SPECS.FEATURE.width);
      expect(result.height).toBe(IMAGE_SPECS.FEATURE.height);
    });

    it('should validate image type', async () => {
      const request: ImageGenerationRequest = {
        type: 'invalid' as ImageType,
        prompt: 'Test',
      };

      try {
        await client.generateImage(request);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Invalid image type');
      }
    });

    it('should handle empty prompt', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: '',
      };

      try {
        await client.generateImage(request);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Prompt is required');
      }
    });

    it('should poll for completion with timeout', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-789',
              status: 'processing',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-789',
              status: 'processing',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-789',
              status: 'completed',
              imageUrl: 'https://cdn.nanobanana.io/images/result.png',
              width: 1200,
              height: 1200,
              format: 'png',
            }),
        });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      const result = await client.generateImage(request, { pollInterval: 100 });

      expect(result.status).toBe('completed');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle generation failure', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-fail',
              status: 'processing',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-fail',
              status: 'failed',
              error: 'Content policy violation',
            }),
        });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      try {
        await client.generateImage(request, { pollInterval: 10 });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Content policy violation');
      }
    });

    it('should not include Shopify branding in prompt', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'App icon with Shopify logo',
      };

      try {
        await client.generateImage(request);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Prompt cannot contain Shopify branding');
      }
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jobId: 'job-123',
            status: 'processing',
            progress: 50,
          }),
      });

      const status = await client.getJobStatus('job-123');

      expect(status.jobId).toBe('job-123');
      expect(status.status).toBe('processing');
      expect(status.progress).toBe(50);
    });

    it('should handle non-existent job', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Job not found' }),
      });

      try {
        await client.getJobStatus('invalid-job');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Job not found');
      }
    });
  });

  describe('checkVersion', () => {
    it('should return current API version', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            version: '2.1.0',
            releaseDate: '2025-01-01',
            features: ['icon-generation', 'feature-images', 'style-transfer'],
          }),
      });

      const versionInfo = await client.checkVersion();

      expect(versionInfo.version).toBe('2.1.0');
      expect(versionInfo.features).toContain('icon-generation');
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple images in batch', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: `batch-${callCount}`,
              status: 'completed',
              imageUrl: `https://cdn.nanobanana.io/${callCount}.png`,
              width: 1600,
              height: 900,
              format: 'png',
            }),
        });
      });

      const requests: ImageGenerationRequest[] = [
        { type: 'feature', prompt: 'Feature 1' },
        { type: 'feature', prompt: 'Feature 2' },
      ];

      const results = await client.generateBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('completed');
    });

    it('should respect concurrent limit', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: `job-${callCount}`,
              status: 'completed',
              imageUrl: `https://cdn.nanobanana.io/${callCount}.png`,
              width: 1600,
              height: 900,
              format: 'png',
            }),
        });
      });

      const requests: ImageGenerationRequest[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          type: 'feature' as ImageType,
          prompt: `Feature ${i}`,
        }));

      await client.generateBatch(requests, { concurrentLimit: 2 });

      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('error handling', () => {
    it('should handle rate limiting', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: { get: () => '0' },
            json: () => Promise.resolve({ error: 'Rate limited' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jobId: 'job-123',
              status: 'completed',
              imageUrl: 'https://cdn.nanobanana.io/icon.png',
              width: 1200,
              height: 1200,
              format: 'png',
            }),
        });
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      const result = await client.generateImage(request);

      expect(result.status).toBe('completed');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failed'));

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test',
      };

      try {
        await client.generateImage(request);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError);
        expect((error as Error).message).toContain('Network failed');
      }
    });
  });
});
