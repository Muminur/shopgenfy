import { NextRequest, NextResponse } from 'next/server';
import { createNanoBananaClient, NanoBananaError } from '@/lib/nanobanana';

const VALID_IMAGE_TYPES = ['icon', 'feature'] as const;

export async function POST(request: NextRequest) {
  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Nano Banana API key not configured' }, { status: 500 });
  }

  let body: {
    type?: string;
    prompt?: string;
    style?: string;
    featureHighlight?: string;
    negativePrompt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: 'Image type is required' }, { status: 400 });
  }

  if (!VALID_IMAGE_TYPES.includes(body.type as (typeof VALID_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: 'Invalid image type. Must be "icon" or "feature"' },
      { status: 400 }
    );
  }

  if (!body.prompt) {
    return NextResponse.json({ error: 'Image prompt is required' }, { status: 400 });
  }

  try {
    const client = createNanoBananaClient(apiKey);
    const result = await client.generateImage({
      type: body.type as 'icon' | 'feature',
      prompt: body.prompt,
      style: body.style as 'flat' | 'modern' | 'gradient' | 'minimalist' | '3d' | undefined,
      featureHighlight: body.featureHighlight,
      negativePrompt: body.negativePrompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
