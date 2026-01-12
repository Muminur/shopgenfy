import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, GeminiError } from '@/lib/gemini';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

const rateLimiter = createRateLimiter(rateLimitConfigs.gemini.analyze);

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.error('[/api/gemini/analyze] GEMINI_API_KEY is missing or empty in .env.local');
    return NextResponse.json(
      {
        error: 'Gemini API key not configured. Please add your GEMINI_API_KEY to .env.local file.',
        help: 'Get your API key from https://aistudio.google.com/app/apikey',
      },
      { status: 503 }
    );
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Validate URL format and protocol
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  // Only allow HTTP/HTTPS protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 });
  }

  try {
    const client = createGeminiClient(apiKey);
    const analysis = await client.analyzeUrl(body.url);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[/api/gemini/analyze] Error analyzing URL:', body.url);
    console.error('[/api/gemini/analyze] Error details:', error);

    if (error instanceof GeminiError) {
      console.error(
        '[/api/gemini/analyze] GeminiError:',
        error.message,
        'Status:',
        error.statusCode
      );
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/gemini/analyze] Non-GeminiError:', errorMessage);
    return NextResponse.json({ error: `Failed to analyze URL: ${errorMessage}` }, { status: 500 });
  }
}
