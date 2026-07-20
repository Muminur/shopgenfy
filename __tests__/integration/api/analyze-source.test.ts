// @vitest-environment node
// Node environment: this route parses multipart/form-data via request.formData()
// and the real source-extractor uses adm-zip, neither of which works under jsdom.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import AdmZip from 'adm-zip';

// Mock only the Gemini client; the source-extractor runs for real so the route's
// extract -> analyzeContent wiring is exercised end-to-end.
vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    analyzeContent: vi.fn(),
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const mockAnalysis = {
  appName: 'Source App',
  appIntroduction: 'Built from local source',
  appDescription: 'Analyzed straight from an uploaded archive.',
  featureList: ['Feature A'],
  languages: ['en'],
  primaryCategory: 'Store management',
  featureTags: ['source'],
  pricing: { type: 'free' as const },
  confidence: 0.8,
  screenshots: [],
  warnings: [],
};

async function setAnalyzeContent(impl: (...args: unknown[]) => unknown) {
  const { createGeminiClient } = await import('@/lib/gemini');
  const analyzeContent = vi.fn(impl);
  (createGeminiClient as ReturnType<typeof vi.fn>).mockReturnValue({ analyzeContent });
  return analyzeContent;
}

function zipRequest(files: Record<string, Buffer | string>, extra?: Record<string, string>) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  const form = new FormData();
  const bytes = new Uint8Array(zip.toBuffer());
  form.append('file', new Blob([bytes], { type: 'application/zip' }), 'source.zip');
  if (extra) {
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
  }
  return new NextRequest('http://localhost/api/analyze/source', { method: 'POST', body: form });
}

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/analyze/source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analyze/source', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    const { clearRateLimitStore } = await import('@/lib/middleware/rate-limiter');
    clearRateLimitStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts a zip, feeds analyzeContent, and returns the analysis + screenshots', async () => {
    const analyzeContent = await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    const png = Buffer.concat([PNG_SIGNATURE, Buffer.from('shot')]);
    const request = zipRequest({
      'repo/README.md':
        '# Cool App\nA storefront helper.\nAPI_KEY=sk-should-be-redacted\nMore descriptive text here.',
      'repo/docs/home.png': png,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.appName).toBe('Source App');

    // The real extractor produced the prepared content handed to analyzeContent.
    expect(analyzeContent).toHaveBeenCalledTimes(1);
    const prepared = analyzeContent.mock.calls[0][0] as {
      textContent: string;
      images: { base64: string; mimeType: string }[];
      screenshots: { base64: string; mimeType: string }[];
    };
    expect(prepared.textContent).toContain('Cool App');
    expect(prepared.textContent).not.toContain('sk-should-be-redacted');
    expect(prepared.textContent).toContain('[redacted]');
    expect(prepared.images).toHaveLength(1);
    expect(prepared.images[0].mimeType).toBe('image/png');
    expect(prepared.screenshots).toHaveLength(1);
  });

  it('accepts pasted text (JSON body) and analyzes it', async () => {
    const analyzeContent = await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    const response = await POST(
      jsonRequest({
        text: 'This app helps merchants manage inventory and automate order fulfillment tasks.',
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.appName).toBe('Source App');
    expect(analyzeContent).toHaveBeenCalledTimes(1);
    const prepared = analyzeContent.mock.calls[0][0] as { textContent: string };
    expect(prepared.textContent).toContain('manage inventory');
  });

  it('passes an explicit model through to analyzeContent', async () => {
    const analyzeContent = await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    await POST(
      jsonRequest({
        text: 'This app helps merchants manage inventory and automate order fulfillment tasks.',
        model: 'gemini-flash-latest',
      })
    );

    expect(analyzeContent.mock.calls[0][1]).toEqual({ model: 'gemini-flash-latest' });
  });

  it('returns 400 with a code when the zip trips a decompression-bomb guard', async () => {
    await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    const files: Record<string, Buffer | string> = {};
    for (let i = 0; i < 2001; i++) files[`f${i}.txt`] = 'x';
    const response = await POST(zipRequest(files));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('ZIP_BOMB');
  });

  it('returns 400 when the source has no analyzable text', async () => {
    const analyzeContent = await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    // A zip with only a screenshot and no README/docs => empty text.
    const response = await POST(
      zipRequest({ 'docs/shot.png': Buffer.concat([PNG_SIGNATURE, Buffer.from('x')]) })
    );

    expect(response.status).toBe(400);
    expect(analyzeContent).not.toHaveBeenCalled();
  });

  it('returns 400 when neither a file nor text is provided', async () => {
    await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 503 when the Gemini API key is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    await setAnalyzeContent(() => mockAnalysis);
    const { POST } = await import('@/app/api/analyze/source/route');

    const response = await POST(
      jsonRequest({ text: 'A description long enough to be analyzed by the pipeline downstream.' })
    );
    expect(response.status).toBe(503);
  });

  it('maps a GeminiError from analyzeContent to its status code', async () => {
    const { GeminiError } = await import('@/lib/gemini');
    await setAnalyzeContent(() => {
      throw new GeminiError('Rate limited', 429);
    });
    const { POST } = await import('@/app/api/analyze/source/route');

    const response = await POST(
      jsonRequest({ text: 'A description long enough to be analyzed by the pipeline downstream.' })
    );
    expect(response.status).toBe(429);
  });
});
