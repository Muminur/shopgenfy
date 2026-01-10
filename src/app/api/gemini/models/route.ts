import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, GeminiError } from '@/lib/gemini';
<<<<<<< HEAD
import { withCacheHeaders, CachePresets } from '@/lib/cache';
=======
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

const rateLimiter = createRateLimiter(rateLimitConfigs.gemini.models);

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
>>>>>>> 2ffb81e (feat(m4): add rate limiting middleware to API routes)

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  try {
    const client = createGeminiClient(apiKey);

    // Get filter parameter if provided
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || undefined;

    const models = await client.listModels({ filter });

    const response = NextResponse.json({ models });

    // Cache models list for 1 hour (models don't change frequently)
    return withCacheHeaders(response, CachePresets.PUBLIC_MEDIUM);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
