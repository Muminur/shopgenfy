import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe.skip('Bug Fix: Nanobanana Image Generation (DEPRECATED - Mock mode removed, using Pollinations.ai)', () => {
  const originalEnv = process.env.NANO_BANANA_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NANO_BANANA_API_KEY = originalEnv;
  });

  describe('POST /api/nanobanana/generate - Development Mode', () => {
    it('should fail gracefully when API key is missing and mock mode explicitly disabled', async () => {
      // Simulate missing API key with mock mode explicitly disabled
      delete process.env.NANO_BANANA_API_KEY;
      process.env.NANO_BANANA_MOCK_MODE = 'false';

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'Professional app icon for Test App',
          style: 'modern',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('API key not configured');
    });

    it('should return mock data when NANO_BANANA_MOCK_MODE is enabled', async () => {
      // Enable mock mode for development
      process.env.NANO_BANANA_API_KEY = 'mock-key-for-testing';
      process.env.NANO_BANANA_MOCK_MODE = 'true';

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'Professional app icon for Test App',
          style: 'modern',
        }),
      });

      const response = await POST(request);

      // In mock mode, should return 200 with mock image data
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.image).toBeDefined();
      expect(data.image.url).toContain('placeholder'); // Mock should return placeholder
      expect(data.image.width).toBe(1200); // Icon dimensions
      expect(data.image.height).toBe(1200);
    });

    it('should return mock feature image with correct dimensions', async () => {
      process.env.NANO_BANANA_API_KEY = 'mock-key-for-testing';
      process.env.NANO_BANANA_MOCK_MODE = 'true';

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature',
          prompt: 'Feature showcase: Advanced analytics',
          featureHighlight: 'Advanced analytics',
          style: 'modern',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.image).toBeDefined();
      expect(data.image.width).toBe(1600); // Feature dimensions
      expect(data.image.height).toBe(900);
      expect(data.image.altText).toContain('Advanced analytics');
    });

    it('should validate request schema even in mock mode', async () => {
      process.env.NANO_BANANA_API_KEY = 'mock-key-for-testing';
      process.env.NANO_BANANA_MOCK_MODE = 'true';

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid-type', // Invalid type
          prompt: 'Test prompt',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle real API when mock mode is disabled', async () => {
      // Set real API key and disable mock mode
      process.env.NANO_BANANA_API_KEY = 'real-api-key';
      delete process.env.NANO_BANANA_MOCK_MODE;

      // Mock the actual nanobanana client to avoid real API calls
      vi.mock('@/lib/nanobanana', async () => {
        const actual = await vi.importActual('@/lib/nanobanana');
        return {
          ...actual,
          createNanoBananaClient: vi.fn(() => ({
            generateImage: vi.fn().mockResolvedValue({
              jobId: 'real-job-123',
              status: 'completed',
              imageUrl: 'https://api.nanobanana.io/images/real-123.png',
              width: 1200,
              height: 1200,
              format: 'png',
            }),
          })),
        };
      });

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'Professional app icon',
          style: 'modern',
        }),
      });

      const response = await POST(request);

      // Should attempt real API call (mocked to succeed)
      expect(response.status).toBe(200);
    });
  });

  describe('Mock Image Generation Logic', () => {
    it('should generate unique mock IDs for each request', async () => {
      process.env.NANO_BANANA_API_KEY = 'mock-key-for-testing';
      process.env.NANO_BANANA_MOCK_MODE = 'true';

      // Reset module cache to ensure fresh import with correct env
      vi.resetModules();
      const { POST } = await import('@/app/api/nanobanana/generate/route');

      // Generate same prompt twice
      const request1 = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'Same prompt',
          style: 'modern',
        }),
      });

      const response1 = await POST(request1);

      // Check response status and structure
      expect(response1.status).toBe(200);
      const data1 = await response1.json();

      // Mock should generate IDs with proper structure
      expect(data1.image).toBeDefined();
      expect(data1.image.id).toBeDefined();
      expect(typeof data1.image.id).toBe('string');
      expect(data1.image.id).toContain('mock-icon-');
    });
  });
});
