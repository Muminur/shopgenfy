import { NextRequest, NextResponse } from 'next/server';
import {
  createImagenClient,
  ImagenError,
  SHOPIFY_IMAGE_SPECS,
  ReferenceScreenshot,
} from '@/lib/imagen';

export const maxDuration = 60; // Allow up to 60 seconds for image generation

interface GenerateRequest {
  type: 'icon' | 'feature' | 'all';
  appName: string;
  appDescription?: string;
  features?: string[];
  featureText?: string;
  screenshots?: ReferenceScreenshot[];
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Imagen API key not configured' }, { status: 500 });
    }

    const body: GenerateRequest = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: 'type is required (icon, feature, or all)' },
        { status: 400 }
      );
    }

    if (!body.appName || body.appName.trim() === '') {
      return NextResponse.json({ error: 'appName is required' }, { status: 400 });
    }

    const client = createImagenClient(apiKey);

    if (body.type === 'icon') {
      const image = await client.generateAppIcon(body.appName, body.appDescription);
      return NextResponse.json({
        success: true,
        image: {
          id: image.id,
          url: image.url,
          width: image.width,
          height: image.height,
          type: image.type,
          altText: image.altText,
          mimeType: image.mimeType,
        },
        specs: SHOPIFY_IMAGE_SPECS.appIcon,
      });
    }

    if (body.type === 'feature') {
      if (!body.featureText || body.featureText.trim() === '') {
        return NextResponse.json(
          { error: 'featureText is required for feature images' },
          { status: 400 }
        );
      }

      const image = await client.generateFeatureImage(
        body.appName,
        body.featureText,
        body.appDescription
      );
      return NextResponse.json({
        success: true,
        image: {
          id: image.id,
          url: image.url,
          width: image.width,
          height: image.height,
          type: image.type,
          altText: image.altText,
          mimeType: image.mimeType,
        },
        specs: SHOPIFY_IMAGE_SPECS.featureImage,
      });
    }

    if (body.type === 'all') {
      const features = body.features?.filter((f) => f.trim()) || [];
      if (features.length === 0) {
        return NextResponse.json(
          { error: 'At least one feature is required for generating all images' },
          { status: 400 }
        );
      }

      // Pass screenshots if provided for multimodal generation
      const images = await client.generateAllImages(
        body.appName,
        body.appDescription || '',
        features,
        body.screenshots
      );

      return NextResponse.json({
        success: true,
        images: images.map((img) => ({
          id: img.id,
          url: img.url,
          width: img.width,
          height: img.height,
          type: img.type,
          altText: img.altText,
          mimeType: img.mimeType,
        })),
        count: images.length,
        usedScreenshots: body.screenshots ? body.screenshots.length : 0,
        specs: {
          icon: SHOPIFY_IMAGE_SPECS.appIcon,
          feature: SHOPIFY_IMAGE_SPECS.featureImage,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid type. Use icon, feature, or all' }, { status: 400 });
  } catch (error) {
    console.error('Imagen generation error:', error);

    if (error instanceof ImagenError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
