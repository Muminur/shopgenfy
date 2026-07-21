// @vitest-environment node
// Node environment: this route parses multipart/form-data via request.formData()
// and normalizes bytes with sharp, neither of which works under jsdom.
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { imageStore } from '@/lib/image-store';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

function uploadRequest(
  file: Buffer,
  filename: string,
  mime: string,
  fields: Record<string, string> = {}
) {
  const form = new FormData();
  const bytes = new Uint8Array(file);
  form.append('file', new Blob([bytes], { type: mime }), filename);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new NextRequest('http://localhost/api/screenshots/upload', {
    method: 'POST',
    body: form,
  });
}

describe('POST /api/screenshots/upload', () => {
  beforeEach(() => {
    imageStore.clear();
  });

  it('normalizes an uploaded PNG to the exact icon spec and stores it as provider "upload"', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const png = await makePng(1024, 1024);

    const response = await POST(uploadRequest(png, 'logo.png', 'image/png', { kind: 'icon' }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image).toBeDefined();
    expect(data.image.provider).toBe('upload');
    expect(data.image.type).toBe('icon');
    expect(data.image.width).toBe(1200);
    expect(data.image.height).toBe(1200);
    expect(data.image.url).toBe(`/api/images/${data.image.id}`);

    // The bytes actually put in the store are exactly 1200x1200 PNG.
    const entry = imageStore.get(data.image.id);
    expect(entry).toBeDefined();
    const meta = await sharp(entry!.buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
    expect(meta.format).toBe('png');
  });

  it('normalizes an uploaded image to the exact feature spec (1600x900)', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const png = await makePng(1280, 720);

    const response = await POST(uploadRequest(png, 'shot.png', 'image/png', { kind: 'feature' }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image.width).toBe(1600);
    expect(data.image.height).toBe(900);

    const entry = imageStore.get(data.image.id);
    const meta = await sharp(entry!.buffer).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);
  });

  it('carries an optional submissionId through to the store', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const png = await makePng(1024, 1024);

    const response = await POST(
      uploadRequest(png, 'logo.png', 'image/png', { kind: 'icon', submissionId: 'sub-9' })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image.submissionId).toBe('sub-9');
    expect(imageStore.list('sub-9')).toHaveLength(1);
  });

  it('rejects a .gif upload with 400 (unsupported image type) before touching the store', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const gif = Buffer.from('GIF89a', 'ascii');

    const response = await POST(uploadRequest(gif, 'anim.gif', 'image/gif', { kind: 'feature' }));

    expect(response.status).toBe(400);
    expect(imageStore.list()).toHaveLength(0);
  });

  it('rejects a file larger than 10 MB with 400 (TOO_LARGE)', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0);

    const response = await POST(uploadRequest(big, 'big.png', 'image/png', { kind: 'icon' }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('TOO_LARGE');
  });

  it('returns 400 when no file is provided', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const form = new FormData();
    form.append('kind', 'icon');
    const request = new NextRequest('http://localhost/api/screenshots/upload', {
      method: 'POST',
      body: form,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid kind', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const png = await makePng(512, 512);

    const response = await POST(uploadRequest(png, 'x.png', 'image/png', { kind: 'banner' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when kind is missing', async () => {
    const { POST } = await import('@/app/api/screenshots/upload/route');
    const png = await makePng(512, 512);

    const response = await POST(uploadRequest(png, 'x.png', 'image/png'));
    expect(response.status).toBe(400);
  });
});
