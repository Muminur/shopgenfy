import { NextRequest, NextResponse } from 'next/server';
import { createNanoBananaClient, NanoBananaError } from '@/lib/nanobanana';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.status);

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Nano Banana API key not configured' }, { status: 500 });
  }

  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  try {
    const client = createNanoBananaClient(apiKey);
    const status = await client.getJobStatus(jobId);

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    return NextResponse.json({ error: 'Failed to get job status' }, { status: 500 });
  }
}
