// @vitest-environment node
// Runs under the node environment (not jsdom): adm-zip's central-directory
// parser returns no entries under jsdom, and the export route runs in the
// node runtime in production anyway.
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import AdmZip from 'adm-zip';
import { POST } from '@/app/api/export/route';
import { imageStore } from '@/lib/image-store';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makePng(tag: string): Buffer {
  // A buffer whose first 8 bytes are the PNG signature (the route copies bytes
  // verbatim; we only need the magic header to assert real image content).
  return Buffer.concat([PNG_SIGNATURE, Buffer.from(`fake-png-${tag}`)]);
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseSubmission = {
  appName: 'Export Me',
  appIntroduction: 'A tagline',
  appDescription: 'A description of the app.',
  features: ['Fast', 'Reliable'],
  languages: ['en'],
  worksWith: [],
  primaryCategory: 'Productivity',
  secondaryCategory: '',
  pricing: { type: 'free' as const },
  landingPageUrl: 'https://example.com',
};

describe('POST /api/export (stateless)', () => {
  beforeEach(() => {
    imageStore.clear();
  });

  it('returns a zip with real PNG bytes for the icon and feature images', async () => {
    const icon = imageStore.put({
      buffer: makePng('icon'),
      width: 1200,
      height: 1200,
      type: 'icon',
      altText: 'App icon',
      provider: 'pollinations',
    });
    const feature1 = imageStore.put({
      buffer: makePng('feature1'),
      width: 1600,
      height: 900,
      type: 'feature',
      altText: 'Feature one',
      provider: 'gemini',
      featureText: 'Fast',
    });
    const feature2 = imageStore.put({
      buffer: makePng('feature2'),
      width: 1600,
      height: 900,
      type: 'feature',
      altText: 'Feature two',
      provider: 'gemini',
      featureText: 'Reliable',
    });

    const response = await POST(
      makeRequest({
        submission: baseSubmission,
        imageIds: [icon.id, feature1.id, feature2.id],
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('.zip');

    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const names = zip.getEntries().map((e) => e.entryName);

    expect(names).toContain('metadata.json');
    expect(names).toContain('README.txt');
    expect(names).toContain('images/icon.png');
    expect(names).toContain('images/feature-1.png');
    expect(names).toContain('images/feature-2.png');

    // Icon entry must carry genuine PNG magic bytes pulled from the store.
    const iconBytes = zip.getEntry('images/icon.png')!.getData();
    expect(iconBytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);

    const metadata = JSON.parse(zip.getEntry('metadata.json')!.getData().toString('utf8'));
    expect(metadata.submission.appName).toBe('Export Me');
    expect(metadata.submission.features).toEqual(['Fast', 'Reliable']);
    expect(metadata.missingImages).toEqual([]);
  });

  it('does not fail when image ids are missing from the store; lists them in metadata', async () => {
    // Simulates a serverless instance whose in-process store never held these
    // ids — the export must still succeed with metadata + README.
    const response = await POST(
      makeRequest({
        submission: baseSubmission,
        imageIds: ['missing-1', 'missing-2'],
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');

    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const names = zip.getEntries().map((e) => e.entryName);

    expect(names).toContain('metadata.json');
    expect(names).not.toContain('images/icon.png');

    const metadata = JSON.parse(zip.getEntry('metadata.json')!.getData().toString('utf8'));
    expect(metadata.missingImages).toEqual(['missing-1', 'missing-2']);
  });

  it('produces a zip even with no image ids at all', async () => {
    const response = await POST(makeRequest({ submission: baseSubmission, imageIds: [] }));

    expect(response.status).toBe(200);
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain('metadata.json');
    expect(names).toContain('README.txt');
  });

  it('rejects a malformed body with 400', async () => {
    const bad = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(bad);
    expect(response.status).toBe(400);
  });
});
