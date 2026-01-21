import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiClient,
  createGeminiClient,
  GeminiError,
  type GeminiModel,
  type GeminiGenerateOptions,
  type GeminiAnalysisResult,
} from '@/lib/gemini';

// Mock the webpage-fetcher module
vi.mock('@/lib/webpage-fetcher', () => ({
  fetchWebpageWithImages: vi.fn(),
  fetchImageAsBase64: vi.fn(),
  WebpageFetchError: class WebpageFetchError extends Error {
    constructor(
      message: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'WebpageFetchError';
    }
  },
}));

import { fetchWebpageWithImages, fetchImageAsBase64 } from '@/lib/webpage-fetcher';

describe('GeminiClient', () => {
  const mockApiKey = 'test-api-key';
  let client: GeminiClient;

  beforeEach(() => {
    client = createGeminiClient(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createGeminiClient', () => {
    it('should create a client with valid API key', () => {
      const client = createGeminiClient('valid-key');
      expect(client).toBeDefined();
      expect(client.listModels).toBeDefined();
      expect(client.generateContent).toBeDefined();
      expect(client.analyzeUrl).toBeDefined();
    });

    it('should throw error for empty API key', () => {
      expect(() => createGeminiClient('')).toThrow(GeminiError);
      expect(() => createGeminiClient('')).toThrow('API key is required');
    });
  });

  describe('listModels', () => {
    it('should return available Gemini models', async () => {
      const mockModels: GeminiModel[] = [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Best model for general text generation',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-pro-vision',
          displayName: 'Gemini Pro Vision',
          description: 'Best model for multimodal generation',
          inputTokenLimit: 12288,
          outputTokenLimit: 4096,
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: mockModels }),
      });

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('models/gemini-pro');
      expect(models[1].displayName).toBe('Gemini Pro Vision');
    });

    it('should filter models by supported generation methods', async () => {
      const mockModels: GeminiModel[] = [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Text generation',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/text-embedding',
          displayName: 'Text Embedding',
          description: 'Embedding only',
          inputTokenLimit: 2048,
          outputTokenLimit: 0,
          supportedGenerationMethods: ['embedContent'],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: mockModels }),
      });

      const models = await client.listModels({ filter: 'generateContent' });

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('models/gemini-pro');
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            error: { message: 'Invalid API key' },
          }),
      });

      try {
        await client.listModels();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiError);
        expect((error as Error).message).toContain('Invalid API key');
      }
    });

    it('should handle network errors with retry', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] }),
        });

      const models = await client.listModels();

      expect(models).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateContent', () => {
    it('should generate content from a prompt', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Generated response text' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.generateContent('Test prompt');

      expect(result.text).toBe('Generated response text');
      expect(result.finishReason).toBe('STOP');
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should use specified model', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Response' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const options: GeminiGenerateOptions = {
        model: 'gemini-pro-vision',
        temperature: 0.7,
        maxOutputTokens: 1000,
      };

      await client.generateContent('Test prompt', options);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-pro-vision'),
        expect.any(Object)
      );
    });

    it('should handle safety blocks', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [], role: 'model' },
            finishReason: 'SAFETY',
          },
        ],
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: [{ category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'HIGH' }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      try {
        await client.generateContent('Unsafe prompt');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiError);
        expect((error as Error).message).toContain('blocked');
      }
    });

    it('should support streaming responses', async () => {
      const mockChunks = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" World"}]}}]}\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"!"}]},"finishReason":"STOP"}]}\n',
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const chunks: string[] = [];
      for await (const chunk of client.generateContentStream('Test')) {
        chunks.push(chunk.text);
      }

      expect(chunks).toEqual(['Hello', ' World', '!']);
    });
  });

  describe('analyzeUrl', () => {
    const mockPageContent = `
      MyApp Store Helper - Streamline your store operations
      A powerful tool that helps merchants manage their online stores efficiently.
      Features: Inventory tracking, Order management, Analytics
    `;

    it('should analyze a landing page URL and extract app info', async () => {
      const mockAnalysis: GeminiAnalysisResult = {
        appName: 'MyApp Store Helper',
        appIntroduction: 'Streamline your store operations',
        appDescription:
          'A powerful tool that helps merchants manage their online stores efficiently.',
        featureList: ['Inventory tracking', 'Order management', 'Analytics'],
        languages: ['en', 'es', 'fr'],
        primaryCategory: 'Store management',
        featureTags: ['inventory', 'orders', 'analytics'],
        pricing: { type: 'freemium' },
        confidence: 0.85,
        screenshots: [],
      };

      // Mock webpage fetch with images
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      // Mock Gemini API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockAnalysis) }],
                  role: 'model',
                },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await client.analyzeUrl('https://example.com/app');

      expect(fetchWebpageWithImages).toHaveBeenCalledWith('https://example.com/app', {
        maxLength: 12000,
      });
      expect(result.appName).toBe('MyApp Store Helper');
      expect(result.featureList).toHaveLength(3);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should validate URL format', async () => {
      await expect(client.analyzeUrl('not-a-url')).rejects.toThrow(GeminiError);
      await expect(client.analyzeUrl('not-a-url')).rejects.toThrow('Invalid URL');
    });

    it('should handle unreachable URLs', async () => {
      const { WebpageFetchError } = await import('@/lib/webpage-fetcher');
      vi.mocked(fetchWebpageWithImages).mockRejectedValue(
        new WebpageFetchError('Failed to fetch: ENOTFOUND', 0)
      );

      await expect(client.analyzeUrl('https://unreachable-domain-xyz.com')).rejects.toThrow(
        GeminiError
      );
      await expect(client.analyzeUrl('https://unreachable-domain-xyz.com')).rejects.toThrow(
        'Failed to fetch page'
      );
    });

    it('should handle pages with insufficient content', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValue({ text: 'Short', images: [] });

      await expect(client.analyzeUrl('https://example.com')).rejects.toThrow(GeminiError);
      await expect(client.analyzeUrl('https://example.com')).rejects.toThrow(
        'insufficient content'
      );
    });

    it('should apply Shopify limits to extracted content', async () => {
      const longName = 'A'.repeat(50);
      const mockAnalysis = {
        appName: longName,
        appIntroduction: 'Short intro',
        appDescription: 'Description',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Store design',
        featureTags: [],
        pricing: { type: 'free' },
        confidence: 0.9,
      };

      // Mock webpage fetch with images
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      // Mock Gemini API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockAnalysis) }],
                  role: 'model',
                },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await client.analyzeUrl('https://example.com');

      expect(result.appName.length).toBeLessThanOrEqual(30);
    });
  });

  describe('error handling', () => {
    it('should handle rate limiting with exponential backoff', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '2' },
          json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] }),
        });

      const startTime = Date.now();
      await client.listModels();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(1000);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should give up after max retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      });

      await expect(client.listModels()).rejects.toThrow(GeminiError);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should include request ID in error for debugging', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: (key: string) => (key === 'x-request-id' ? 'req-123' : null) },
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      });

      try {
        await client.listModels();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeminiError);
        expect((error as GeminiError).requestId).toBe('req-123');
      }
    });
  });
});
