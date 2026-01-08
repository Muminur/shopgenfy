import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, GeminiError } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
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

  // Validate URL format
  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    const client = createGeminiClient(apiKey);
    const analysis = await client.analyzeUrl(body.url);

    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    return NextResponse.json({ error: 'Failed to analyze URL' }, { status: 500 });
  }
}
