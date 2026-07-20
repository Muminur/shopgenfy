import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

// Rate limiting is stubbed so repeated same-IP requests in this file never 429.
vi.mock('@/lib/middleware/rate-limiter', () => ({
  createRateLimiter: vi.fn(() => vi.fn(async () => null)),
  rateLimitConfigs: {
    nanobanana: {
      generate: { requests: 5, windowMs: 60000 },
      status: { requests: 60, windowMs: 60000 },
      batch: { requests: 2, windowMs: 60000 },
    },
  },
}));

// The Imagen client is mocked (no real Gemini call); the normalizer + image
// store run for real, so mocked images must carry real, sharp-decodable bytes.
vi.mock('@/lib/imagen', () => ({
  createImagenClient: vi.fn(),
  ImagenError: class ImagenError extends Error {
    code?: string;
    statusCode?: number;
    constructor(message: string, code?: string, statusCode?: number) {
      super(message);
      this.name = 'ImagenError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  SHOPIFY_IMAGE_SPECS: {
    appIcon: { width: 1200, height: 1200, aspectRatio: '1:1', formats: ['png'] },
    featureImage: { width: 1600, height: 900, aspectRatio: '16:9', formats: ['png'] },
  },
}));

import { POST } from '@/app/api/imagen/generate/route';
import { imageStore } from '@/lib/image-store';

const originalEnv = process.env;

async function pngBytes(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

function idFromUrl(url: string): string {
  return url.replace('/api/images/', '');
}

describe('POST /api/imagen/generate (store-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageStore.clear();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 503 if GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it('returns 400 if type is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ appName: 'Test App' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('type is required');
  });

  it('returns 400 if appName is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('appName is required');
  });

  it('returns 400 if type is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'nonsense', appName: 'Test App' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('Invalid type');
  });

  it('generates an app icon, normalizes to 1200x1200 and stores it at /api/images/<id>', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi.fn().mockResolvedValue({
        id: 'imagen-icon-1',
        buffer: await pngBytes(1024, 1024),
        mimeType: 'image/png',
        width: 1200,
        height: 1200,
        type: 'icon',
        prompt: 'icon prompt',
        altText: 'Test App app icon',
        usedScreenshots: false,
      }),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.image.type).toBe('icon');
    expect(data.image.width).toBe(1200);
    expect(data.image.height).toBe(1200);
    expect(data.image.provider).toBe('gemini');
    expect(data.image.url).toMatch(/^\/api\/images\/[0-9a-f-]+$/i);

    const stored = imageStore.get(idFromUrl(data.image.url));
    expect(stored).toBeDefined();
    const meta = await sharp(stored!.buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
    expect(meta.format).toBe('png');
  });

  it('returns 400 if feature type is missing featureText', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'feature', appName: 'Test App' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('featureText is required');
  });

  it('generates a feature image normalized to 1600x900', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateFeatureImage: vi.fn().mockResolvedValue({
        id: 'imagen-feature-1',
        buffer: await pngBytes(1408, 768),
        mimeType: 'image/png',
        width: 1600,
        height: 900,
        type: 'feature',
        prompt: 'feature prompt',
        altText: 'Test App - Dashboard',
        featureText: 'Dashboard',
        usedScreenshots: false,
      }),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'feature', appName: 'Test App', featureText: 'Dashboard' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.image.width).toBe(1600);
    expect(data.image.height).toBe(900);
    expect(data.image.featureText).toBe('Dashboard');
    expect(data.image.url).toMatch(/^\/api\/images\//);
  });

  it('appends a Shopify 4.4.4 compliance warning when a feature image is prompt-only', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateFeatureImage: vi.fn().mockResolvedValue({
        id: 'imagen-feature-1',
        buffer: await pngBytes(1408, 768),
        mimeType: 'image/png',
        width: 1600,
        height: 900,
        type: 'feature',
        prompt: 'feature prompt',
        altText: 'Test App - Dashboard',
        featureText: 'Dashboard',
        usedScreenshots: false,
      }),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'feature', appName: 'Test App', featureText: 'Dashboard' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(Array.isArray(data.warnings)).toBe(true);
    expect(data.warnings.join(' ')).toMatch(/4\.4\.4/);
  });

  it('generates all images and returns store-backed StoredImages with usedScreenshots count', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAllImages: vi.fn().mockResolvedValue([
        {
          id: 'icon',
          buffer: await pngBytes(1024, 1024),
          mimeType: 'image/png',
          width: 1200,
          height: 1200,
          type: 'icon',
          prompt: 'p',
          altText: 'Test App app icon',
          usedScreenshots: false,
        },
        {
          id: 'f1',
          buffer: await pngBytes(1600, 900),
          mimeType: 'image/png',
          width: 1600,
          height: 900,
          type: 'feature',
          prompt: 'p',
          altText: 'Test App - Feature 1',
          featureText: 'Feature 1',
          usedScreenshots: true,
        },
        {
          id: 'f2',
          buffer: await pngBytes(1600, 900),
          mimeType: 'image/png',
          width: 1600,
          height: 900,
          type: 'feature',
          prompt: 'p',
          altText: 'Test App - Feature 2',
          featureText: 'Feature 2',
          usedScreenshots: true,
        },
      ]),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'all',
        appName: 'Test App',
        appDescription: 'A test application',
        features: ['Feature 1', 'Feature 2'],
        screenshots: [{ base64: 'YQ==', mimeType: 'image/png' }],
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.images).toHaveLength(3);
    expect(data.count).toBe(3);
    expect(data.usedScreenshots).toBe(2);
    expect(data.images[0].type).toBe('icon');
    expect(data.images.every((i: { url: string }) => /^\/api\/images\//.test(i.url))).toBe(true);
  });

  it('maps an UPSTREAM ImagenError to 502', async () => {
    const { createImagenClient, ImagenError } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi.fn().mockRejectedValue(new ImagenError('upstream boom', 'UPSTREAM', 502)),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(502);
  });

  it('maps a generic error to 500', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi.fn().mockRejectedValue(new Error('boom')),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
