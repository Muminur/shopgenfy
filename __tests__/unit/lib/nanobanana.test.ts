import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NanoBananaClient,
  createNanoBananaClient,
  NanoBananaError,
  type ImageGenerationRequest,
} from '@/lib/nanobanana';
import { IMAGE_SPECS } from '@/lib/validators/constants';

describe('NanoBananaClient (Pollinations.ai)', () => {
  let client: NanoBananaClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = createNanoBananaClient(); // No API key needed for Pollinations
    fetchMock = vi.fn();
    global.fetch = fetchMock as any; // Type assertion for mock compatibility
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNanoBananaClient', () => {
    it('should create a client without API key', () => {
      const client = createNanoBananaClient();
      expect(client).toBeDefined();
      expect(client.generateImage).toBeDefined();
      expect(client.getJobStatus).toBeDefined();
      expect(client.checkVersion).toBeDefined();
    });

    it('should create a client with API key (ignored for backwards compatibility)', () => {
      const client = createNanoBananaClient('ignored-key');
      expect(client).toBeDefined();
      expect(client.generateImage).toBeDefined();
    });
  });

  describe('generateImage', () => {
    it('should generate an app icon with correct dimensions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'A modern app icon for a store management tool',
        style: 'flat',
      };

      const result = await client.generateImage(request);

      expect(result.width).toBe(IMAGE_SPECS.ICON.width);
      expect(result.height).toBe(IMAGE_SPECS.ICON.height);
      expect(result.imageUrl).toContain('image.pollinations.ai');
      expect(result.status).toBe('completed');
      expect(result.format).toBe('png');
    });

    it('should generate a feature image with correct dimensions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'feature',
        prompt: 'A feature showcase image',
      };

      const result = await client.generateImage(request);

      expect(result.width).toBe(IMAGE_SPECS.FEATURE.width);
      expect(result.height).toBe(IMAGE_SPECS.FEATURE.height);
      expect(result.imageUrl).toContain('image.pollinations.ai');
    });

    it('should validate image type', async () => {
      const request = {
        type: 'invalid' as any,
        prompt: 'Test prompt',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Invalid image type');
    });

    it('should handle empty prompt', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: '',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Prompt is required');
    });

    it('should handle generation failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: () => null,
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test prompt',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Pollinations.ai API error');
    });

    it('should not include Shopify branding in prompt', async () => {
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Shopify logo icon',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Shopify branding');
    });

    it('should build proper Pollinations URL with seed', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      const result = await client.generateImage(request);

      expect(result.imageUrl).toContain('image.pollinations.ai/prompt');
      expect(result.imageUrl).toContain('width=1200');
      expect(result.imageUrl).toContain('height=1200');
      expect(result.imageUrl).toContain('seed=');
      expect(result.imageUrl).toContain('nologo=true');
      expect(result.imageUrl).toContain('enhance=true');
    });

    it('should include negative patterns in prompt', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Clean icon',
        negativePrompt: 'no text, no watermark',
      };

      await client.generateImage(request);

      const fetchCall = fetchMock.mock.calls[0][0] as string;
      expect(fetchCall).toContain('no%20');
    });

    it('should verify content-type is image', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Response is not an image');
    });
  });

  describe('getJobStatus', () => {
    it('should return completed status for valid Pollinations job', async () => {
      const jobId = 'pollinations-icon-12345-67890';
      const status = await client.getJobStatus(jobId);

      expect(status.jobId).toBe(jobId);
      expect(status.status).toBe('completed');
      expect(status.progress).toBe(100);
    });

    it('should handle invalid job ID', async () => {
      await expect(client.getJobStatus('invalid-job')).rejects.toThrow(NanoBananaError);
      await expect(client.getJobStatus('invalid-job')).rejects.toThrow('Invalid job ID');
    });
  });

  describe('checkVersion', () => {
    it('should return Pollinations.ai version info', async () => {
      const versionInfo = await client.checkVersion();

      expect(versionInfo.version).toBe('1.0.0');
      expect(versionInfo.features).toContain('Free API');
      expect(versionInfo.features).toContain('No authentication required');
      expect(versionInfo.releaseDate).toBeDefined();
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple images in batch', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const requests: ImageGenerationRequest[] = [
        { type: 'icon', prompt: 'Icon 1' },
        { type: 'icon', prompt: 'Icon 2' },
        { type: 'feature', prompt: 'Feature 1' },
      ];

      const results = await client.generateBatch(requests);

      expect(results).toHaveLength(3);
      expect(results[0].width).toBe(IMAGE_SPECS.ICON.width);
      expect(results[2].width).toBe(IMAGE_SPECS.FEATURE.width);
    });

    it('should respect concurrent limit', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const requests: ImageGenerationRequest[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'icon' as const,
        prompt: `Icon ${i}`,
      }));

      await client.generateBatch(requests, { concurrentLimit: 2 });

      // With concurrentLimit=2, 10 images should be processed in 5 batches
      // We can't easily verify the exact batching without more complex mocking
      // But we can verify all images were generated
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
    });

    it('should handle network failures', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test',
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('Failed to generate image');
    });

    it('should handle timeout using AbortController', async () => {
      // Helper to create abort mock - needs to be called for each expect
      const createAbortMock = () =>
        fetchMock.mockImplementationOnce(
          (_url: string, options: RequestInit) =>
            new Promise((_resolve, reject) => {
              const signal = options?.signal;
              if (signal) {
                signal.addEventListener('abort', () => {
                  const error = new Error('The operation was aborted');
                  error.name = 'AbortError';
                  reject(error);
                });
              }
            })
        );

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test',
      };

      // Use a very short timeout for testing - set up mock for each expect call
      createAbortMock();
      await expect(client.generateImage(request, { timeout: 10 })).rejects.toThrow(NanoBananaError);
      createAbortMock();
      await expect(client.generateImage(request, { timeout: 10 })).rejects.toThrow(
        'Image generation timed out'
      );
    });

    it('should reject prompts exceeding maximum length', async () => {
      const longPrompt = 'a'.repeat(2001);
      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: longPrompt,
      };

      await expect(client.generateImage(request)).rejects.toThrow(NanoBananaError);
      await expect(client.generateImage(request)).rejects.toThrow('exceeds maximum length');
    });

    it('should apply style parameter to prompt', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        } as any,
      });

      const request: ImageGenerationRequest = {
        type: 'icon',
        prompt: 'Test icon',
        style: 'modern',
      };

      await client.generateImage(request);

      const fetchCall = fetchMock.mock.calls[0][0] as string;
      expect(fetchCall).toContain('modern%20style');
    });
  });
});
