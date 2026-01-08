import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Nano Banana client
vi.mock('@/lib/nanobanana', () => ({
  createNanoBananaClient: vi.fn(() => ({
    generateImage: vi.fn(),
    getJobStatus: vi.fn(),
    checkVersion: vi.fn(),
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

describe('Nano Banana API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NANO_BANANA_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/nanobanana/generate', () => {
    it('should generate an image and return job info', async () => {
      const mockResult = {
        jobId: 'job-123',
        status: 'completed',
        imageUrl: 'https://cdn.nanobanana.io/images/job-123.png',
        width: 1200,
        height: 1200,
        format: 'png',
      };

      const { createNanoBananaClient } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      });

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'A simple app icon for an e-commerce tool',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jobId).toBe('job-123');
      expect(data.status).toBe('completed');
      expect(data.imageUrl).toBeDefined();
    });

    it('should return 400 for missing type', async () => {
      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A simple icon' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('type');
    });

    it('should return 400 for missing prompt', async () => {
      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'icon' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // Zod returns detailed validation error about missing/undefined string
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid image type', async () => {
      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid-type',
          prompt: 'A simple icon',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('type');
    });

    it('should return 500 when API key is not configured', async () => {
      delete process.env.NANO_BANANA_API_KEY;

      vi.resetModules();
      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'A simple icon',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should return 500 when generation fails', async () => {
      const { createNanoBananaClient, NanoBananaError } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        generateImage: vi.fn().mockRejectedValue(new NanoBananaError('Generation failed', 500)),
      });

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: 'A simple icon',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle feature image type with correct dimensions', async () => {
      const mockResult = {
        jobId: 'job-456',
        status: 'completed',
        imageUrl: 'https://cdn.nanobanana.io/images/job-456.png',
        width: 1600,
        height: 900,
        format: 'png',
      };

      const { createNanoBananaClient } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      });

      const { POST } = await import('@/app/api/nanobanana/generate/route');
      const request = new NextRequest('http://localhost/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature',
          prompt: 'A feature image showing dashboard',
          featureHighlight: 'Real-time analytics',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.width).toBe(1600);
      expect(data.height).toBe(900);
    });
  });

  describe('GET /api/nanobanana/status/[jobId]', () => {
    it('should return job status', async () => {
      const mockStatus = {
        jobId: 'job-123',
        status: 'completed',
        imageUrl: 'https://cdn.nanobanana.io/images/job-123.png',
        width: 1200,
        height: 1200,
        format: 'png',
      };

      const { createNanoBananaClient } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getJobStatus: vi.fn().mockResolvedValue(mockStatus),
      });

      const { GET } = await import('@/app/api/nanobanana/status/[jobId]/route');
      const request = new NextRequest('http://localhost/api/nanobanana/status/job-123');
      const response = await GET(request, { params: Promise.resolve({ jobId: 'job-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jobId).toBe('job-123');
      expect(data.status).toBe('completed');
    });

    it('should return processing status for incomplete jobs', async () => {
      const mockStatus = {
        jobId: 'job-789',
        status: 'processing',
        progress: 50,
      };

      const { createNanoBananaClient } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getJobStatus: vi.fn().mockResolvedValue(mockStatus),
      });

      const { GET } = await import('@/app/api/nanobanana/status/[jobId]/route');
      const request = new NextRequest('http://localhost/api/nanobanana/status/job-789');
      const response = await GET(request, { params: Promise.resolve({ jobId: 'job-789' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('processing');
      expect(data.progress).toBe(50);
    });

    it('should return 404 for non-existent job', async () => {
      const { createNanoBananaClient, NanoBananaError } = await import('@/lib/nanobanana');
      (createNanoBananaClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getJobStatus: vi.fn().mockRejectedValue(new NanoBananaError('Job not found', 404)),
      });

      const { GET } = await import('@/app/api/nanobanana/status/[jobId]/route');
      const request = new NextRequest('http://localhost/api/nanobanana/status/invalid-job');
      const response = await GET(request, { params: Promise.resolve({ jobId: 'invalid-job' }) });

      expect(response.status).toBe(404);
    });
  });
});
