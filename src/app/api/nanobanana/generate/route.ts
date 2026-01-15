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

/**
 * Generate mock image data for development/testing without real API calls
 */
function generateMockImage(type: 'icon' | 'feature', prompt: string, featureHighlight?: string) {
  const dimensions = type === 'icon' ? { width: 1200, height: 1200 } : { width: 1600, height: 900 };
  const mockId = `mock-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Use placeholder.com for mock images with appropriate dimensions and text
  const encodedPrompt = encodeURIComponent(prompt.substring(0, 50));
  const placeholderUrl = `https://via.placeholder.com/${dimensions.width}x${dimensions.height}/4A90E2/FFFFFF?text=${encodedPrompt}`;

  return {
    image: {
      id: mockId,
      url: placeholderUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: 'png' as const,
      altText: featureHighlight || prompt,
    },
  };
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.NANO_BANANA_API_KEY;
  const mockModeEnv = process.env.NANO_BANANA_MOCK_MODE;
  const nodeEnv = process.env.NODE_ENV;

  // In production, always require API key unless explicitly in mock mode
  if (nodeEnv === 'production' && !apiKey && mockModeEnv !== 'true') {
    console.error('[CRITICAL] Nanobanana API key missing in production');
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // Auto-enable mock mode in development only
  const mockMode =
    mockModeEnv === 'true' || (nodeEnv !== 'production' && !apiKey && mockModeEnv !== 'false');

  // Log when using mock mode (except in test environment)
  if (mockMode && nodeEnv !== 'test') {
    console.warn('[DEV] Using Nanobanana mock mode - no real API calls');
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

  // Return mock data if in mock mode (for development without real API)
  if (mockMode) {
    const mockData = generateMockImage(
      parseResult.data.type,
      parseResult.data.prompt,
      parseResult.data.featureHighlight
    );
    return NextResponse.json(mockData);
  }

  // If we get here without an API key and not in mock mode, return error
  if (!apiKey) {
    return NextResponse.json({ error: 'Nano Banana API key not configured' }, { status: 500 });
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
