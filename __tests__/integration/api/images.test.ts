import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { imageStore } from '@/lib/image-store';

describe('Image store API routes', () => {
  beforeEach(() => {
    imageStore.clear();
  });

  describe('GET /api/images/[id]', () => {
    it('serves the stored PNG bytes with the correct headers', async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const meta = imageStore.put({
        buffer: bytes,
        width: 1200,
        height: 1200,
        type: 'icon',
        altText: 'App icon',
        provider: 'upload',
      });

      const { GET } = await import('@/app/api/images/[id]/route');
      const request = new NextRequest(`http://localhost/api/images/${meta.id}`);
      const response = await GET(request, { params: Promise.resolve({ id: meta.id }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400');

      const arrayBuffer = await response.arrayBuffer();
      expect(Buffer.from(arrayBuffer).equals(bytes)).toBe(true);
    });

    it('returns 404 for an unknown id', async () => {
      const { GET } = await import('@/app/api/images/[id]/route');
      const request = new NextRequest('http://localhost/api/images/does-not-exist');
      const response = await GET(request, {
        params: Promise.resolve({ id: 'does-not-exist' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/images', () => {
    it('returns { images: [...] } filtered by submissionId', async () => {
      const a = imageStore.put({
        buffer: Buffer.from([1]),
        width: 1200,
        height: 1200,
        type: 'icon',
        altText: 'icon for sub-1',
        provider: 'upload',
        submissionId: 'sub-1',
      });
      imageStore.put({
        buffer: Buffer.from([2]),
        width: 1600,
        height: 900,
        type: 'feature',
        altText: 'feature for sub-2',
        provider: 'upload',
        submissionId: 'sub-2',
      });

      const { GET } = await import('@/app/api/images/route');
      const request = new NextRequest('http://localhost/api/images?submissionId=sub-1');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.images)).toBe(true);
      expect(data.images).toHaveLength(1);
      expect(data.images[0].id).toBe(a.id);
      expect(data.images[0].url).toBe(`/api/images/${a.id}`);
    });

    it('returns all images when submissionId is omitted', async () => {
      imageStore.put({
        buffer: Buffer.from([1]),
        width: 1200,
        height: 1200,
        type: 'icon',
        altText: 'a',
        provider: 'upload',
      });
      imageStore.put({
        buffer: Buffer.from([2]),
        width: 1600,
        height: 900,
        type: 'feature',
        altText: 'b',
        provider: 'upload',
      });

      const { GET } = await import('@/app/api/images/route');
      const request = new NextRequest('http://localhost/api/images');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.images).toHaveLength(2);
    });

    it('returns an empty list when nothing is stored', async () => {
      const { GET } = await import('@/app/api/images/route');
      const request = new NextRequest('http://localhost/api/images?submissionId=none');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.images).toEqual([]);
    });
  });
});
