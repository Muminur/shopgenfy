import { NextRequest, NextResponse } from 'next/server';
import {
  createImagenClient,
  ImagenError,
  SHOPIFY_IMAGE_SPECS,
  ReferenceScreenshot,
  ImagenGeneratedImage,
} from '@/lib/imagen';
import { normalizeImage, ImageNormalizeError } from '@/lib/image-normalizer';
import { imageStore, StoredImage } from '@/lib/image-store';
import { createRateLimiter, rateLimitConfigs } from '@/lib/middleware/rate-limiter';
import { COMPLIANCE_WARNING } from '@/lib/validators/constants';

export const maxDuration = 60; // Allow up to 60 seconds for image generation

interface GenerateRequest {
  type: 'icon' | 'feature' | 'all';
  appName: string;
  appDescription?: string;
  features?: string[];
  featureText?: string;
  screenshots?: ReferenceScreenshot[];
  submissionId?: string;
}

const rateLimiter = createRateLimiter(rateLimitConfigs.nanobanana.generate);

/**
 * Normalize a freshly generated image to its exact Shopify spec and put it in
 * the in-process image store, returning the store metadata (whose `url` is a
 * same-origin `/api/images/<id>`).
 */
async function normalizeAndStore(
  image: ImagenGeneratedImage,
  submissionId?: string
): Promise<StoredImage> {
  const normalized = await normalizeImage(image.buffer, image.type);
  return imageStore.put({
    buffer: normalized.buffer,
    width: normalized.width,
    height: normalized.height,
    type: image.type,
    altText: image.altText,
    provider: 'gemini',
    featureText: image.featureText,
    submissionId,
  });
}

function collectWarnings(images: ImagenGeneratedImage[]): string[] {
  const warnings: string[] = [];
  if (images.some((img) => img.type === 'feature' && !img.usedScreenshots)) {
    warnings.push(COMPLIANCE_WARNING);
  }
  return warnings;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Imagen API key not configured' }, { status: 503 });
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json(
      { error: 'type is required (icon, feature, or all)' },
      { status: 400 }
    );
  }

  if (!body.appName || body.appName.trim() === '') {
    return NextResponse.json({ error: 'appName is required' }, { status: 400 });
  }

  if (body.type !== 'icon' && body.type !== 'feature' && body.type !== 'all') {
    return NextResponse.json({ error: 'Invalid type. Use icon, feature, or all' }, { status: 400 });
  }

  if (body.type === 'feature' && (!body.featureText || body.featureText.trim() === '')) {
    return NextResponse.json(
      { error: 'featureText is required for feature images' },
      { status: 400 }
    );
  }

  if (body.type === 'all') {
    const features = body.features?.filter((f) => f.trim()) || [];
    if (features.length === 0) {
      return NextResponse.json(
        { error: 'At least one feature is required for generating all images' },
        { status: 400 }
      );
    }
  }

  try {
    const client = createImagenClient(apiKey);

    if (body.type === 'icon') {
      const generated = await client.generateAppIcon(body.appName, body.appDescription);
      const stored = await normalizeAndStore(generated, body.submissionId);
      return NextResponse.json({
        success: true,
        image: stored,
        usedScreenshots: generated.usedScreenshots ? 1 : 0,
        warnings: [],
        specs: SHOPIFY_IMAGE_SPECS.appIcon,
      });
    }

    if (body.type === 'feature') {
      const generated = await client.generateFeatureImage(
        body.appName,
        body.featureText as string,
        body.appDescription
      );
      const stored = await normalizeAndStore(generated, body.submissionId);
      return NextResponse.json({
        success: true,
        image: stored,
        usedScreenshots: generated.usedScreenshots ? 1 : 0,
        warnings: collectWarnings([generated]),
        specs: SHOPIFY_IMAGE_SPECS.featureImage,
      });
    }

    // type === 'all'
    const features = (body.features || []).filter((f) => f.trim());
    const generatedImages = await client.generateAllImages(
      body.appName,
      body.appDescription || '',
      features,
      body.screenshots
    );

    const stored = await Promise.all(
      generatedImages.map((img) => normalizeAndStore(img, body.submissionId))
    );

    return NextResponse.json({
      success: true,
      images: stored,
      count: stored.length,
      usedScreenshots: generatedImages.filter((img) => img.usedScreenshots).length,
      warnings: collectWarnings(generatedImages),
      specs: {
        icon: SHOPIFY_IMAGE_SPECS.appIcon,
        feature: SHOPIFY_IMAGE_SPECS.featureImage,
      },
    });
  } catch (error) {
    console.error('Imagen generation error:', error);

    if (error instanceof ImageNormalizeError) {
      // The upstream model produced bytes we could not coerce to spec.
      return NextResponse.json(
        { error: `Image normalization failed: ${error.message}`, code: error.code },
        { status: 502 }
      );
    }

    if (error instanceof ImagenError) {
      const status = error.statusCode ?? (error.code === 'UPSTREAM' ? 502 : 400);
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
