import { NextRequest, NextResponse } from 'next/server';
import { createNanoBananaClient, NanoBananaError } from '@/lib/nanobanana';
import { z } from 'zod';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';

const generateImageSchema = z.object({
  type: z.enum(['icon', 'feature'], { message: 'Image type must be "icon" or "feature"' }),
  prompt: z.string().min(1, 'Image prompt is required'),
  style: z.enum(['flat', 'modern', 'gradient', 'minimalist', '3d']).optional(),
  featureHighlight: z.string().optional(),
  negativePrompt: z.string().optional(),
});

const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.generate);

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Nano Banana API key not configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate using Zod schema
  const parseResult = generateImageSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: errors }, { status: 400 });
  }

  try {
    const client = createNanoBananaClient(apiKey);
    const result = await client.generateImage(parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
