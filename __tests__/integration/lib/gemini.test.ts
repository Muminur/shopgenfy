import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGeminiClient, GeminiError, type GeminiClient } from '@/lib/gemini';

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

/**
 * Integration tests for Gemini API client
 * Tests actual client functions with mocked HTTP responses
 * Focuses on: error handling, retry logic, response parsing
 */
describe('Gemini API Client - Integration Tests', () => {
  const mockApiKey = 'test-gemini-api-key-123';
  let client: GeminiClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = createGeminiClient(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('listModels - API Integration', () => {
    it('should successfully fetch and parse models list from API', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-pro',
            displayName: 'Gemini Pro',
            description: 'Best model for scaling across a wide range of tasks',
            inputTokenLimit: 30720,
            outputTokenLimit: 2048,
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/gemini-pro-vision',
            displayName: 'Gemini Pro Vision',
            description: 'Best model for multimodal generation',
            inputTokenLimit: 12288,
            outputTokenLimit: 4096,
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('models/gemini-pro');
      expect(models[1].supportedGenerationMethods).toContain('generateContent');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1beta/models'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-goog-api-key': mockApiKey,
          }),
        })
      );
    });

    it('should handle 429 rate limit with retry-after header', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Map([['retry-after', '1']]),
            json: async () => ({ error: { message: 'Rate limited' } }),
          };
        }
        return {
          ok: true,
          json: async () => ({ models: [] }),
        };
      });

      const models = await client.listModels();

      expect(callCount).toBe(2);
      expect(models).toEqual([]);
    });

    it('should retry on 500 server errors and eventually succeed', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: { message: 'Server error' } }),
          };
        }
        return {
          ok: true,
          json: async () => ({ models: [] }),
        };
      });

      const models = await client.listModels();

      expect(callCount).toBe(3);
      expect(models).toEqual([]);
    });

    it('should throw GeminiError after max retries exceeded', async () => {
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'Persistent server error' } }),
      }));

      await expect(client.listModels()).rejects.toThrow(GeminiError);
    });

    it('should handle network failures with retry', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network connection failed');
        }
        return {
          ok: true,
          json: async () => ({ models: [] }),
        };
      });

      const models = await client.listModels();

      expect(callCount).toBe(2);
      expect(models).toEqual([]);
    });
  });

  describe('generateContent - API Integration', () => {
    it('should successfully generate content with full response parsing', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Generated content response' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.generateContent('Test prompt');

      expect(result.text).toBe('Generated content response');
      expect(result.finishReason).toBe('STOP');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(30);
    });

    it('should handle content blocked by safety filters', async () => {
      const mockResponse = {
        promptFeedback: {
          blockReason: 'SAFETY',
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.generateContent('Unsafe prompt')).rejects.toThrow(
        'Content blocked: SAFETY'
      );
    });

    it('should handle empty response from API', async () => {
      const mockResponse = {
        candidates: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.generateContent('Test prompt')).rejects.toThrow('No response generated');
    });

    it('should handle candidate blocked for safety concerns', async () => {
      const mockResponse = {
        candidates: [
          {
            finishReason: 'SAFETY',
            content: { parts: [] },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.generateContent('Test prompt')).rejects.toThrow(
        'Content blocked due to safety concerns'
      );
    });

    it('should pass custom generation options to API', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Response' }] },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.generateContent('Test prompt', {
        model: 'gemini-pro-vision',
        temperature: 0.5,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 20,
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.generationConfig.temperature).toBe(0.5);
      expect(requestBody.generationConfig.maxOutputTokens).toBe(1024);
      expect(requestBody.generationConfig.topP).toBe(0.8);
      expect(requestBody.generationConfig.topK).toBe(20);
    });

    it('should retry on 429 rate limit during generation', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Map([['retry-after', '1']]),
            json: async () => ({ error: { message: 'Rate limited' } }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: { parts: [{ text: 'Success' }] },
                finishReason: 'STOP',
              },
            ],
          }),
        };
      });

      const result = await client.generateContent('Test prompt');

      expect(callCount).toBe(2);
      expect(result.text).toBe('Success');
    });
  });

  describe('generateContentStream - API Integration', () => {
    it('should stream content chunks with proper parsing', async () => {
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"text":"First chunk"}]}}]}\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"Second chunk"}]}}]}\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"Third chunk"}]},"finishReason":"STOP"}]}\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex >= mockStreamData.length) {
            return { done: true, value: undefined };
          }
          const chunk = new TextEncoder().encode(mockStreamData[chunkIndex]);
          chunkIndex++;
          return { done: false, value: chunk };
        }),
        releaseLock: vi.fn(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as unknown as Response);

      const chunks: string[] = [];
      for await (const chunk of client.generateContentStream('Test prompt')) {
        chunks.push(chunk.text);
      }

      expect(chunks).toEqual(['First chunk', 'Second chunk', 'Third chunk']);
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle stream errors gracefully', async () => {
      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(new Error('Stream read error')),
        releaseLock: vi.fn(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as unknown as Response);

      const generator = client.generateContentStream('Test prompt');

      await expect(generator.next()).rejects.toThrow('Stream read error');
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should throw error when stream reader is unavailable', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: null,
      } as Response);

      const generator = client.generateContentStream('Test prompt');

      await expect(generator.next()).rejects.toThrow('Failed to get stream reader');
    });
  });

  describe('analyzeUrl - API Integration', () => {
    const mockPageContent = `
      Test App - A great app for Shopify merchants
      This app helps you manage your store efficiently.
      Features: Feature 1, Feature 2, Feature 3
    `;

    it('should analyze URL and return structured data with truncation', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    appName: 'My Super Long App Name That Exceeds Maximum Character Limit',
                    appIntroduction: 'A great app for Shopify merchants',
                    appDescription: 'This app helps you manage your store efficiently',
                    featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
                    languages: ['en', 'fr', 'de'],
                    primaryCategory: 'Store design',
                    featureTags: ['productivity', 'design', 'automation'],
                    pricing: {
                      type: 'freemium',
                      price: 9.99,
                      currency: 'USD',
                      billingCycle: 'monthly',
                    },
                    confidence: 0.95,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.analyzeUrl('https://example.com');

      expect(fetchWebpageWithImages).toHaveBeenCalledWith('https://example.com', {
        maxLength: 12000,
      });
      expect(result.appName.length).toBeLessThanOrEqual(30);
      expect(result.appIntroduction).toBe('A great app for Shopify merchants');
      expect(result.featureList).toHaveLength(3);
      expect(result.confidence).toBe(0.95);
      expect(result.pricing.type).toBe('freemium');
    });

    it('should throw error for invalid URL format', async () => {
      await expect(client.analyzeUrl('not-a-valid-url')).rejects.toThrow('Invalid URL format');
    });

    it('should handle malformed JSON response from API', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid JSON' }],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(client.analyzeUrl('https://example.com')).rejects.toThrow(
        'Failed to parse analysis response'
      );
    });

    it('should handle partial data with defaults', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    appName: 'Partial App',
                    confidence: 0.6,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.analyzeUrl('https://example.com');

      expect(result.appName).toBe('Partial App');
      expect(result.appIntroduction).toBe('');
      expect(result.languages).toEqual(['en']);
      expect(result.primaryCategory).toBe('Store design');
      expect(result.pricing).toEqual({ type: 'free' });
    });

    it('should truncate feature list items exceeding character limit', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const longFeature = 'A'.repeat(100);
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    appName: 'Test App',
                    featureList: [longFeature, 'Short feature'],
                    confidence: 0.8,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.analyzeUrl('https://example.com');

      expect(result.featureList[0].length).toBeLessThanOrEqual(80);
      expect(result.featureList[0]).toContain('...');
      expect(result.featureList[1]).toBe('Short feature');
    });

    it('should limit feature tags to maximum allowed', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const manyTags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    appName: 'Test App',
                    featureTags: manyTags,
                    confidence: 0.9,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.analyzeUrl('https://example.com');

      expect(result.featureTags.length).toBeLessThanOrEqual(25);
    });

    it('should clamp confidence value between 0 and 1', async () => {
      const testCases = [
        { input: 1.5, expected: 1 },
        { input: -0.2, expected: 0 },
        { input: 0.7, expected: 0.7 },
      ];

      for (const { input, expected } of testCases) {
        vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
          text: mockPageContent,
          images: [],
        });
        vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      appName: 'Test App',
                      confidence: input,
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await client.analyzeUrl('https://example.com');
        expect(result.confidence).toBe(expected);
      }
    });

    it('should use lower temperature for analysis calls', async () => {
      vi.mocked(fetchWebpageWithImages).mockResolvedValueOnce({
        text: mockPageContent,
        images: [],
      });
      vi.mocked(fetchImageAsBase64).mockResolvedValue(null);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    appName: 'Test App',
                    confidence: 0.8,
                  }),
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.analyzeUrl('https://example.com');

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.generationConfig.temperature).toBe(0.3);
      expect(requestBody.generationConfig.maxOutputTokens).toBe(4096);
    });
  });

  describe('Error Handling - API Integration', () => {
    it('should handle 401 unauthorized errors', async () => {
      const mockHeaders = new Headers();
      mockHeaders.set('x-request-id', 'req-123');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: mockHeaders,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      } as unknown as Response);

      await expect(client.listModels()).rejects.toThrow(GeminiError);

      try {
        await client.listModels();
      } catch (error) {
        expect(error).toMatchObject({
          message: 'Invalid API key',
          statusCode: 401,
          requestId: 'req-123',
        });
      }
    });

    it('should handle 403 forbidden errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        json: async () => ({ error: { message: 'Access denied' } }),
      } as unknown as Response);

      await expect(client.listModels()).rejects.toThrow('Access denied');
    });

    it('should handle response without error body', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('No JSON');
        },
      } as unknown as Response);

      await expect(client.listModels()).rejects.toThrow(GeminiError);
    });
  });
});
