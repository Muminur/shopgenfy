import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, GeminiError, type PreparedContent } from '@/lib/gemini';
import { extractFromZip, extractFromText, SourceExtractError } from '@/lib/source-extractor';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

export const maxDuration = 60; // Analysis calls the model; allow headroom.

/** Reject uploads larger than this before reading the body into memory. */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
/** Below this, there is nothing meaningful to analyze. Matches the pipeline. */
const MIN_TEXT_LENGTH = 50;

// Local source analysis is an expensive per-request operation (extraction + a
// model call), so it reuses the strict 5/min generation limiter.
const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.generate);

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return NextResponse.json(
      {
        error: 'Gemini API key not configured. Please add your GEMINI_API_KEY to .env.local file.',
        help: 'Get your API key from https://aistudio.google.com/app/apikey',
      },
      { status: 503 }
    );
  }

  const contentType = request.headers.get('content-type') || '';
  let prepared: PreparedContent;
  let model: string | undefined;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { error: 'A zip file is required in the "file" field' },
          { status: 400 }
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Uploaded file exceeds the 30 MB limit', code: 'TOO_LARGE' },
          { status: 400 }
        );
      }
      const modelField = form.get('model');
      if (typeof modelField === 'string' && modelField.trim()) {
        model = modelField.trim();
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      prepared = extractFromZip(buffer);
    } else {
      let body: { text?: string; model?: string };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      if (!body.text || body.text.trim() === '') {
        return NextResponse.json(
          { error: 'A zip file or pasted text is required' },
          { status: 400 }
        );
      }
      if (typeof body.model === 'string' && body.model.trim()) {
        model = body.model.trim();
      }
      prepared = extractFromText(body.text);
    }
  } catch (error) {
    if (error instanceof SourceExtractError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[/api/analyze/source] Extraction error:', error);
    return NextResponse.json({ error: 'Failed to read the provided source' }, { status: 400 });
  }

  if (!prepared.textContent || prepared.textContent.trim().length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error:
          'The source contains no analyzable text. Include a README/description or paste one directly.',
      },
      { status: 400 }
    );
  }

  try {
    const client = createGeminiClient(apiKey);
    const analysis = await client.analyzeContent(prepared, { model });
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[/api/analyze/source] Analysis error:', error);
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to analyze source: ${message}` }, { status: 500 });
  }
}
