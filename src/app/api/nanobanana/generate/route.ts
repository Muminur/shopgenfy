import { NextRequest, NextResponse } from 'next/server';
import { createNanoBananaClient, NanoBananaError } from '@/lib/nanobanana';
import { normalizeImage, ImageNormalizeError } from '@/lib/image-normalizer';
import { imageStore } from '@/lib/image-store';
import { z } from 'zod';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';
import { COMPLIANCE_WARNING } from '@/lib/validators/constants';

const generateImageSchema = z.object({
  type: z.enum(['icon', 'feature'], { message: 'Image type must be "icon" or "feature"' }),
  prompt: z.string().min(1, 'Image prompt is required'),
  style: z.enum(['flat', 'modern', 'gradient', 'minimalist', '3d']).optional(),
  featureHighlight: z.string().optional(),
  negativePrompt: z.string().optional(),
  submissionId: z.string().optional(),
});

const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.generate);

// Mock mode removed - using real Pollinations.ai API (FREE, no API key needed)

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
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

  const { type, featureHighlight, submissionId } = parseResult.data;

  try {
    // Create Pollinations.ai client (FREE API - no API key needed)
    const client = createNanoBananaClient();
    const result = await client.generateImage(parseResult.data);

    if (!result.buffer) {
      throw new NanoBananaError('Image provider returned no image bytes', 502);
    }

    // Normalize to the exact Shopify spec, then store the bytes and serve them
    // from a stable same-origin URL (no third-party hotlink / data: URI).
    const normalized = await normalizeImage(result.buffer, type);
    const stored = imageStore.put({
      buffer: normalized.buffer,
      width: normalized.width,
      height: normalized.height,
      type,
      altText: featureHighlight ? `${featureHighlight}` : `Generated ${type} image`,
      provider: 'pollinations',
      featureText: featureHighlight,
      submissionId,
    });

    // Pollinations has no screenshot-reference capability at all, so every
    // feature image it produces is prompt-only and must carry the Shopify
    // 4.4.4 compliance warning. Icons are exempt (4.4.4 concerns listing
    // imagery that shows actual UI, not the app icon).
    const warnings = type === 'feature' ? [COMPLIANCE_WARNING] : [];

    return NextResponse.json({
      image: stored,
      jobId: result.jobId,
      status: result.status,
      warnings,
    });
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    if (error instanceof ImageNormalizeError) {
      return NextResponse.json(
        { error: `Image normalization failed: ${error.message}`, code: error.code },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
