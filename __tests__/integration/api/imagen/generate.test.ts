import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/imagen/generate/route';

// Mock the imagen module
vi.mock('@/lib/imagen', () => ({
  createImagenClient: vi.fn(),
  ImagenError: class ImagenError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.name = 'ImagenError';
      this.code = code;
    }
  },
  SHOPIFY_IMAGE_SPECS: {
    appIcon: {
      width: 1200,
      height: 1200,
      aspectRatio: '1:1',
      formats: ['png', 'jpeg'],
      description: 'App icon - square format',
    },
    featureImage: {
      width: 1600,
      height: 900,
      aspectRatio: '16:9',
      formats: ['png', 'jpeg'],
      description: 'Feature/screenshot image - widescreen format',
    },
  },
}));

const originalEnv = process.env;

describe('POST /api/imagen/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  it('returns 500 if GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Imagen API key not configured');
  });

  it('returns 400 if type is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('type is required');
  });

  it('returns 400 if appName is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('appName is required');
  });

  it('returns 400 if appName is empty string', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('appName is required');
  });

  it('returns 400 if type is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid', appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid type');
  });

  it('generates app icon successfully', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi.fn().mockResolvedValue({
        id: 'imagen-icon-123',
        url: 'data:image/png;base64,test',
        width: 1200,
        height: 1200,
        type: 'icon',
        altText: 'Test App app icon',
        mimeType: 'image/png',
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
    expect(data.image).toBeDefined();
    expect(data.image.type).toBe('icon');
    expect(data.image.width).toBe(1200);
    expect(data.image.height).toBe(1200);
    expect(data.specs).toBeDefined();
  });

  it('returns 400 if feature type is missing featureText', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'feature', appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('featureText is required');
  });

  it('generates feature image successfully', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateFeatureImage: vi.fn().mockResolvedValue({
        id: 'imagen-feature-123',
        url: 'data:image/png;base64,test',
        width: 1600,
        height: 900,
        type: 'feature',
        altText: 'Test App - Dashboard Analytics',
        mimeType: 'image/png',
      }),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'feature',
        appName: 'Test App',
        featureText: 'Dashboard Analytics',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.image).toBeDefined();
    expect(data.image.type).toBe('feature');
    expect(data.image.width).toBe(1600);
    expect(data.image.height).toBe(900);
  });

  it('returns 400 if all type is missing features', async () => {
    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'all',
        appName: 'Test App',
        features: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('At least one feature is required');
  });

  it('generates all images successfully', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAllImages: vi.fn().mockResolvedValue([
        {
          id: 'imagen-icon-123',
          url: 'data:image/png;base64,icon',
          width: 1200,
          height: 1200,
          type: 'icon',
          altText: 'Test App app icon',
          mimeType: 'image/png',
        },
        {
          id: 'imagen-feature-123',
          url: 'data:image/png;base64,feature1',
          width: 1600,
          height: 900,
          type: 'feature',
          altText: 'Test App - Feature 1',
          mimeType: 'image/png',
        },
        {
          id: 'imagen-feature-456',
          url: 'data:image/png;base64,feature2',
          width: 1600,
          height: 900,
          type: 'feature',
          altText: 'Test App - Feature 2',
          mimeType: 'image/png',
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
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.images).toHaveLength(3);
    expect(data.count).toBe(3);
    expect(data.images[0].type).toBe('icon');
    expect(data.images[1].type).toBe('feature');
    expect(data.images[2].type).toBe('feature');
    expect(data.specs.icon).toBeDefined();
    expect(data.specs.feature).toBeDefined();
  });

  it('handles ImagenError correctly', async () => {
    const { createImagenClient, ImagenError } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi
        .fn()
        .mockRejectedValue(new ImagenError('Generation blocked by safety filter', 'SAFETY_BLOCK')),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Generation blocked by safety filter');
    expect(data.code).toBe('SAFETY_BLOCK');
  });

  it('handles generic errors correctly', async () => {
    const { createImagenClient } = await import('@/lib/imagen');
    const mockClient = {
      generateAppIcon: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    (createImagenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const request = new NextRequest('http://localhost:3000/api/imagen/generate', {
      method: 'POST',
      body: JSON.stringify({ type: 'icon', appName: 'Test App' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Network error');
  });
});
