import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Gemini client
vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    listModels: vi.fn(),
    generateContent: vi.fn(),
    analyzeUrl: vi.fn(),
  })),
  GeminiError: class GeminiError extends Error {
    constructor(
      message: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'GeminiError';
    }
  },
}));

describe('Gemini API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/gemini/models', () => {
    it('should return list of available models', async () => {
      const mockModels = [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Best for text generation',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-pro-vision',
          displayName: 'Gemini Pro Vision',
          description: 'Best for multimodal tasks',
          inputTokenLimit: 12288,
          outputTokenLimit: 4096,
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      const { createGeminiClient } = await import('@/lib/gemini');
      (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({
        listModels: vi.fn().mockResolvedValue(mockModels),
      });

      const { GET } = await import('@/app/api/gemini/models/route');
      const request = new NextRequest('http://localhost:3000/api/gemini/models');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.models).toHaveLength(2);
      expect(data.models[0].name).toBe('models/gemini-pro');
    });

    it('should return 500 when API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;

      // Re-import to get fresh module
      vi.resetModules();
      const { GET } = await import('@/app/api/gemini/models/route');
      const request = new NextRequest('http://localhost:3000/api/gemini/models');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('not configured');
    });

    it('should return 500 when Gemini API fails', async () => {
      const { createGeminiClient, GeminiError } = await import('@/lib/gemini');
      (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({
        listModels: vi.fn().mockRejectedValue(new GeminiError('API error', 500)),
      });

      const { GET } = await import('@/app/api/gemini/models/route');
      const request = new NextRequest('http://localhost:3000/api/gemini/models');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should filter models by generation method when specified', async () => {
      const mockModels = [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
        },
      ];

      const { createGeminiClient } = await import('@/lib/gemini');
      (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({
        listModels: vi.fn().mockResolvedValue(mockModels),
      });

      const { GET } = await import('@/app/api/gemini/models/route');
      const request = new NextRequest(
        'http://localhost/api/gemini/models?filter=streamGenerateContent'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/gemini/analyze', () => {
    it('should analyze a URL and return form data', async () => {
      const mockAnalysis = {
        appName: 'MyBrand App',
        appIntroduction: 'A helpful e-commerce tool',
        appDescription: 'This app helps merchants with their stores.',
        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
        languages: ['en'],
        primaryCategory: 'Store design',
        featureTags: ['productivity', 'automation'],
        pricing: { type: 'free' as const },
        confidence: 0.85,
      };

      const { createGeminiClient } = await import('@/lib/gemini');
      (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({
        analyzeUrl: vi.fn().mockResolvedValue(mockAnalysis),
      });

      const { POST } = await import('@/app/api/gemini/analyze/route');
      const request = new NextRequest('http://localhost/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/app' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.appName).toBe('MyBrand App');
      expect(data.confidence).toBe(0.85);
    });

    it('should return 400 for missing URL', async () => {
      const { POST } = await import('@/app/api/gemini/analyze/route');
      const request = new NextRequest('http://localhost/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('URL is required');
    });

    it('should return 400 for invalid URL format', async () => {
      const { POST } = await import('@/app/api/gemini/analyze/route');
      const request = new NextRequest('http://localhost/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-valid-url' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid URL');
    });

    it('should return 500 when analysis fails', async () => {
      const { createGeminiClient, GeminiError } = await import('@/lib/gemini');
      (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({
        analyzeUrl: vi.fn().mockRejectedValue(new GeminiError('Analysis failed', 500)),
      });

      const { POST } = await import('@/app/api/gemini/analyze/route');
      const request = new NextRequest('http://localhost/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/app' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle invalid JSON body', async () => {
      const { POST } = await import('@/app/api/gemini/analyze/route');
      const request = new NextRequest('http://localhost/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
