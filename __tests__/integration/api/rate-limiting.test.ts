import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { clearRateLimitStore } from '@/lib/middleware/rate-limiter';

// Mock MongoDB to avoid connection errors in rate limiting tests
vi.mock('@/lib/mongodb', () => ({
  getDatabaseConnected: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn(),
      updateOne: vi.fn(),
    }),
  }),
}));

//  Mock image DB operations to avoid actual database calls
vi.mock('@/lib/db/images', () => ({
  createGeneratedImage: vi.fn().mockResolvedValue({ _id: 'mock-id' }),
}));

// Mock prompt generator
vi.mock('@/lib/prompt-generator', () => ({
  generateBatchPrompts: vi.fn().mockReturnValue([
    {
      type: 'icon',
      prompt: 'Mock icon prompt',
      width: 1200,
      height: 1200,
      negativePrompt: '',
      featureHighlighted: '',
    },
  ]),
}));

// Mock Gemini client to avoid actual API calls
vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    listModels: vi.fn().mockResolvedValue([
      {
        name: 'models/gemini-pro',
        displayName: 'Gemini Pro',
        description: 'Test model',
        inputTokenLimit: 30720,
        outputTokenLimit: 2048,
        supportedGenerationMethods: ['generateContent'],
      },
    ]),
    analyzeUrl: vi.fn().mockResolvedValue({
      appName: 'Test App',
      appIntroduction: 'Test intro',
      appDescription: 'Test description',
      featureList: ['Feature 1', 'Feature 2'],
      languages: ['en'],
      primaryCategory: 'Sales and marketing',
      featureTags: ['analytics'],
      pricing: { type: 'free' },
      confidence: 0.9,
    }),
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

// Mock Nano Banana client to avoid actual API calls
vi.mock('@/lib/nanobanana', () => ({
  createNanoBananaClient: vi.fn(() => ({
    generateImage: vi.fn().mockResolvedValue({
      jobId: 'test-job-123',
      status: 'queued',
    }),
    getJobStatus: vi.fn().mockResolvedValue({
      jobId: 'test-job-123',
      status: 'completed',
      imageUrl: 'https://example.com/image.png',
    }),
    batchGenerate: vi.fn().mockResolvedValue({
      batchId: 'batch-123',
      jobs: [
        { jobId: 'job-1', status: 'queued' },
        { jobId: 'job-2', status: 'queued' },
      ],
    }),
  })),
  NanoBananaError: class NanoBananaError extends Error {
    constructor(
      message: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'NanoBananaError';
    }
  },
}));

import { GET as getModels } from '@/app/api/gemini/models/route';
import { POST as analyzeUrl } from '@/app/api/gemini/analyze/route';
import { POST as generateImage } from '@/app/api/nanobanana/generate/route';
import { GET as getStatus } from '@/app/api/nanobanana/status/[jobId]/route';
import { POST as batchGenerate } from '@/app/api/nanobanana/batch/route';

describe('API Route Rate Limiting Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStore(); // Clear rate limit state between tests
    // Mock environment variables
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.NANO_BANANA_API_KEY = 'test-nano-banana-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Gemini API Routes Rate Limiting', () => {
    describe('GET /api/gemini/models', () => {
      it('should allow requests within limit (30 req/min)', async () => {
        const ip = '192.168.1.100';

        // Make 30 requests - all should pass
        for (let i = 0; i < 30; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/models', {
            method: 'GET',
            headers: { 'x-forwarded-for': ip },
          });

          const response = await getModels(request);
          expect(response.status).not.toBe(429);
        }
      });

      it('should block 31st request within same minute', async () => {
        const ip = '192.168.1.101';

        // Make 30 requests
        for (let i = 0; i < 30; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/models', {
            method: 'GET',
            headers: { 'x-forwarded-for': ip },
          });
          await getModels(request);
        }

        // 31st request should be blocked
        const request = new NextRequest('http://localhost:3000/api/gemini/models', {
          method: 'GET',
          headers: { 'x-forwarded-for': ip },
        });

        const response = await getModels(request);
        expect(response.status).toBe(429);

        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(body.error).toContain('Too many requests');
      });

      it('should include Retry-After header when rate limited', async () => {
        const ip = '192.168.1.102';

        // Exhaust limit
        for (let i = 0; i < 30; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/models', {
            method: 'GET',
            headers: { 'x-forwarded-for': ip },
          });
          await getModels(request);
        }

        const request = new NextRequest('http://localhost:3000/api/gemini/models', {
          method: 'GET',
          headers: { 'x-forwarded-for': ip },
        });

        const response = await getModels(request);
        expect(response.headers.get('Retry-After')).toBeTruthy();
      });
    });

    describe('POST /api/gemini/analyze', () => {
      it('should allow requests within limit (10 req/min)', async () => {
        const ip = '192.168.1.200';

        // Make 10 requests
        for (let i = 0; i < 10; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({ url: 'https://example.com' }),
          });

          const response = await analyzeUrl(request);
          // May fail due to mocked API, but should not be rate limited
          expect(response.status).not.toBe(429);
        }
      });

      it('should block 11th request within same minute', async () => {
        const ip = '192.168.1.201';

        // Make 10 requests
        for (let i = 0; i < 10; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({ url: 'https://example.com' }),
          });
          await analyzeUrl(request);
        }

        // 11th request should be blocked
        const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({ url: 'https://example.com' }),
        });

        const response = await analyzeUrl(request);
        expect(response.status).toBe(429);
      });

      it('should include rate limit headers', async () => {
        const ip = '192.168.1.202';

        // Exhaust limit
        for (let i = 0; i < 10; i++) {
          const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({ url: 'https://example.com' }),
          });
          await analyzeUrl(request);
        }

        const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({ url: 'https://example.com' }),
        });

        const response = await analyzeUrl(request);
        expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      });
    });
  });

  describe('Nano Banana API Routes Rate Limiting', () => {
    describe('POST /api/nanobanana/generate', () => {
      it('should allow requests within limit (5 req/min)', async () => {
        const ip = '192.168.1.300';

        for (let i = 0; i < 5; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/generate', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({
              type: 'icon',
              prompt: 'A simple app icon',
            }),
          });

          const response = await generateImage(request);
          expect(response.status).not.toBe(429);
        }
      });

      it('should block 6th request within same minute', async () => {
        const ip = '192.168.1.301';

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/generate', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({
              type: 'icon',
              prompt: 'A simple app icon',
            }),
          });
          await generateImage(request);
        }

        // 6th should be blocked
        const request = new NextRequest('http://localhost:3000/api/nanobanana/generate', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({
            type: 'icon',
            prompt: 'A simple app icon',
          }),
        });

        const response = await generateImage(request);
        expect(response.status).toBe(429);
      });
    });

    describe('GET /api/nanobanana/status/[jobId]', () => {
      it('should allow requests within limit (60 req/min)', async () => {
        const ip = '192.168.1.400';

        for (let i = 0; i < 60; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/status/job-123', {
            method: 'GET',
            headers: { 'x-forwarded-for': ip },
          });

          const response = await getStatus(request, {
            params: Promise.resolve({ jobId: 'job-123' }),
          });
          expect(response.status).not.toBe(429);
        }
      });

      it('should block 61st request', async () => {
        const ip = '192.168.1.401';

        // Make 60 requests
        for (let i = 0; i < 60; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/status/job-123', {
            method: 'GET',
            headers: { 'x-forwarded-for': ip },
          });
          await getStatus(request, { params: Promise.resolve({ jobId: 'job-123' }) });
        }

        // 61st blocked
        const request = new NextRequest('http://localhost:3000/api/nanobanana/status/job-123', {
          method: 'GET',
          headers: { 'x-forwarded-for': ip },
        });

        const response = await getStatus(request, {
          params: Promise.resolve({ jobId: 'job-123' }),
        });
        expect(response.status).toBe(429);
      });
    });

    describe('POST /api/nanobanana/batch', () => {
      it('should allow requests within limit (2 req/min)', async () => {
        const ip = '192.168.1.500';

        for (let i = 0; i < 2; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/batch', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({
              submissionId: 'sub-123',
              images: [
                { type: 'icon', prompt: 'Icon' },
                { type: 'feature', prompt: 'Feature 1' },
              ],
            }),
          });

          const response = await batchGenerate(request);
          expect(response.status).not.toBe(429);
        }
      });

      it('should block 3rd request within same minute', async () => {
        const ip = '192.168.1.501';

        // Make 2 requests
        for (let i = 0; i < 2; i++) {
          const request = new NextRequest('http://localhost:3000/api/nanobanana/batch', {
            method: 'POST',
            headers: { 'x-forwarded-for': ip },
            body: JSON.stringify({
              submissionId: 'sub-123',
              images: [
                { type: 'icon', prompt: 'Icon' },
                { type: 'feature', prompt: 'Feature 1' },
              ],
            }),
          });
          await batchGenerate(request);
        }

        // 3rd blocked
        const request = new NextRequest('http://localhost:3000/api/nanobanana/batch', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({
            submissionId: 'sub-123',
            images: [
              { type: 'icon', prompt: 'Icon' },
              { type: 'feature', prompt: 'Feature 1' },
            ],
          }),
        });

        const response = await batchGenerate(request);
        expect(response.status).toBe(429);
      });
    });
  });

  describe('Different IPs Have Separate Limits', () => {
    it('should track rate limits per IP address', async () => {
      const ip1 = '192.168.2.1';
      const ip2 = '192.168.2.2';

      // IP1 exhausts limit
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip1 },
          body: JSON.stringify({ url: 'https://example.com' }),
        });
        await analyzeUrl(request);
      }

      // IP1 blocked
      const request1 = new NextRequest('http://localhost:3000/api/gemini/analyze', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip1 },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      const response1 = await analyzeUrl(request1);
      expect(response1.status).toBe(429);

      // IP2 still allowed
      const request2 = new NextRequest('http://localhost:3000/api/gemini/analyze', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip2 },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      const response2 = await analyzeUrl(request2);
      expect(response2.status).not.toBe(429);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should reset after time window expires', async () => {
      vi.useFakeTimers();
      const ip = '192.168.3.1';

      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({ url: 'https://example.com' }),
        });
        await analyzeUrl(request);
      }

      // Blocked
      let request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      let response = await analyzeUrl(request);
      expect(response.status).toBe(429);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      request = new NextRequest('http://localhost:3000/api/gemini/analyze', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      response = await analyzeUrl(request);
      expect(response.status).not.toBe(429);

      vi.useRealTimers();
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for rate limit exceeded', async () => {
      const ip = '192.168.4.1';

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost:3000/api/nanobanana/generate', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: JSON.stringify({
            type: 'icon',
            prompt: 'Test prompt',
          }),
        });
        await generateImage(request);
      }

      const request = new NextRequest('http://localhost:3000/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'Test prompt',
        }),
      });

      const response = await generateImage(request);
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.stringContaining('Too many requests'),
      });

      // Verify all required headers
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });
});
