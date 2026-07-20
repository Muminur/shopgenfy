import { GoogleGenAI } from '@google/genai';
import { resolveImageModel } from './model-resolver';

// Shopify App Store Image Specifications
export const SHOPIFY_IMAGE_SPECS = {
  appIcon: {
    width: 1200,
    height: 1200,
    aspectRatio: '1:1' as const,
    formats: ['png', 'jpeg'] as const,
    description: 'App icon - square format',
  },
  featureImage: {
    width: 1600,
    height: 900,
    aspectRatio: '16:9' as const,
    formats: ['png', 'jpeg'] as const,
    description: 'Feature/screenshot image - widescreen format',
  },
} as const;

export interface ReferenceScreenshot {
  base64: string;
  mimeType: string;
  alt?: string;
}

export interface ImagenGenerateWithScreenshotsOptions {
  appName: string;
  featureText: string;
  description?: string;
  screenshots: ReferenceScreenshot[];
}

/**
 * A generated image, returned as raw bytes for the route to normalize + store.
 * There is no `data:` URI or base64 payload leaking into app state anymore —
 * the route puts `buffer` through `normalizeImage` + `imageStore`.
 *
 * `usedScreenshots` reflects reality: `true` only when the produced image came
 * from a screenshot-guided model call. A prompt-only fallback sets it `false`
 * so the route can raise the Shopify 4.4.4 compliance warning.
 */
export interface ImagenGeneratedImage {
  id: string;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  type: 'icon' | 'feature';
  prompt: string;
  altText: string;
  featureText?: string;
  usedScreenshots: boolean;
}

export type ImagenErrorCode = 'BAD_INPUT' | 'UPSTREAM' | 'NO_IMAGE' | 'GENERATION_FAILED';

export class ImagenError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ImagenError';
  }
}

export interface ImagenClient {
  generateAppIcon(appName: string, description?: string): Promise<ImagenGeneratedImage>;
  generateFeatureImage(
    appName: string,
    featureText: string,
    description?: string
  ): Promise<ImagenGeneratedImage>;
  generateFeatureImageWithScreenshots(
    options: ImagenGenerateWithScreenshotsOptions
  ): Promise<ImagenGeneratedImage>;
  generateAllImages(
    appName: string,
    appDescription: string,
    features: string[],
    screenshots?: ReferenceScreenshot[]
  ): Promise<ImagenGeneratedImage[]>;
}

function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bshopify\b/gi, '')
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateAltText(type: 'icon' | 'feature', appName: string, feature?: string): string {
  if (type === 'icon') {
    return `${appName} app icon`;
  }
  return feature ? `${appName} - ${feature}` : `${appName} feature image`;
}

/**
 * Choose a distinct subset of screenshots for a given feature-image index.
 *
 * Shopify rule 4.4.5 requires listing images to be unique, so two feature
 * images must never be handed the exact same screenshot set. This returns a
 * contiguous window of the screenshot cycle starting at `index`; windows of
 * length `< n` over an `n`-cycle are pairwise-distinct as sets for every
 * distinct starting index, so no two features collide (the only unavoidable
 * exception is a single available screenshot).
 */
export function selectScreenshotSubset(
  screenshots: ReferenceScreenshot[],
  index: number,
  count = 3
): ReferenceScreenshot[] {
  const n = screenshots.length;
  if (n === 0) return [];
  // Keep window length strictly below n (unless n === 1) so distinct start
  // indices yield distinct sets rather than the whole set for everyone.
  const windowLength = n <= 1 ? n : Math.min(count, n - 1);
  const subset: ReferenceScreenshot[] = [];
  for (let offset = 0; offset < windowLength; offset++) {
    subset.push(screenshots[(index + offset) % n]);
  }
  return subset;
}

export function createImagenClient(apiKey: string): ImagenClient {
  if (!apiKey || apiKey.trim() === '') {
    throw new ImagenError('API key is required');
  }

  // Test seam: point the SDK at a local stub in hermetic E2E via GEMINI_API_BASE.
  // Left unset in production so the SDK uses its own default endpoint.
  const baseUrl = process.env.GEMINI_API_BASE;
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  /**
   * Core generation primitive — one native Gemini image-model call.
   * Uses the dynamically resolved image model (never a hardcoded retired id)
   * with `responseModalities: ['TEXT','IMAGE']` and a spec-driven `imageConfig`
   * so the model natively targets 1:1 / 16:9 at 2K, and the normalizer trims
   * rather than upscales.
   */
  async function generateWithGemini(params: {
    prompt: string;
    type: 'icon' | 'feature';
    screenshots?: ReferenceScreenshot[];
  }): Promise<{ buffer: Buffer; mimeType: string }> {
    const { prompt, type, screenshots } = params;
    const model = resolveImageModel();
    const aspectRatio = type === 'icon' ? '1:1' : '16:9';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [];
    if (screenshots) {
      for (const screenshot of screenshots) {
        contents.push({
          inlineData: { mimeType: screenshot.mimeType, data: screenshot.base64 },
        });
      }
    }
    contents.push({ text: prompt });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    try {
      response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio, imageSize: '2K' },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed';
      throw new ImagenError(message, 'UPSTREAM', 502, error);
    }

    const parts = response?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
      throw new ImagenError('Model returned no content parts', 'NO_IMAGE', 502);
    }

    for (const part of parts) {
      const data = part?.inlineData?.data;
      if (typeof data === 'string' && data.length > 0) {
        return {
          buffer: Buffer.from(data, 'base64'),
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }

    throw new ImagenError('Model returned no image', 'NO_IMAGE', 502);
  }

  function buildIconPrompt(appName: string, description?: string): string {
    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';
    return [
      `Professional app icon for "${sanitizedName}"`,
      sanitizedDesc ? `App concept: ${sanitizedDesc.slice(0, 100)}` : '',
      'Style: modern flat design, minimalist, simple geometric shapes',
      'Bold vibrant colors, single focal point, centered composition',
      'Square format suitable for app store listing',
      'Clean edges, professional look',
      'No Shopify logos or branding',
      'No text overlays',
    ]
      .filter(Boolean)
      .join('. ');
  }

  function buildFeaturePrompt(appName: string, featureText: string, description?: string): string {
    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedFeature = sanitizeForPrompt(featureText);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';
    return [
      `Feature showcase image for "${sanitizedName}" app`,
      `Highlighting: "${sanitizedFeature}"`,
      sanitizedDesc ? `App context: ${sanitizedDesc.slice(0, 100)}` : '',
      'Style: modern UI mockup, clean interface visualization',
      'Professional dashboard or app screen representation',
      'High contrast, clear visual hierarchy',
      '16:9 widescreen format, suitable for app store gallery',
      'No Shopify logos or branding',
      'No browser chrome or URL bars',
    ]
      .filter(Boolean)
      .join('. ');
  }

  function buildScreenshotPrompt(
    appName: string,
    featureText: string,
    description?: string
  ): string {
    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedFeature = sanitizeForPrompt(featureText);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';
    return [
      `Create a professional Shopify App Store feature image for "${sanitizedName}" app.`,
      `Feature to highlight: "${sanitizedFeature}"`,
      sanitizedDesc ? `App description: ${sanitizedDesc.slice(0, 150)}` : '',
      '',
      'IMPORTANT INSTRUCTIONS:',
      '- Use the provided screenshot(s) as the main visual content',
      '- Create a polished, professional app store listing image',
      '- Add subtle design elements like gradient backgrounds or device frames',
      '- Ensure the screenshot is clearly visible and is the focal point',
      '- 16:9 widescreen format',
      '- Use high contrast colors for good visibility',
      '- NO Shopify logos or branding',
      '- NO browser chrome or URL bars',
      '- Keep ~100px safe zone from edges',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function generateAppIcon(
    appName: string,
    description?: string
  ): Promise<ImagenGeneratedImage> {
    const prompt = buildIconPrompt(appName, description);
    const { buffer, mimeType } = await generateWithGemini({ prompt, type: 'icon' });
    return {
      id: `imagen-icon-${Date.now()}`,
      buffer,
      mimeType,
      width: SHOPIFY_IMAGE_SPECS.appIcon.width,
      height: SHOPIFY_IMAGE_SPECS.appIcon.height,
      type: 'icon',
      prompt,
      altText: generateAltText('icon', appName),
      usedScreenshots: false,
    };
  }

  async function generateFeatureImage(
    appName: string,
    featureText: string,
    description?: string
  ): Promise<ImagenGeneratedImage> {
    const prompt = buildFeaturePrompt(appName, featureText, description);
    const { buffer, mimeType } = await generateWithGemini({ prompt, type: 'feature' });
    return {
      id: `imagen-feature-${Date.now()}`,
      buffer,
      mimeType,
      width: SHOPIFY_IMAGE_SPECS.featureImage.width,
      height: SHOPIFY_IMAGE_SPECS.featureImage.height,
      type: 'feature',
      prompt,
      altText: generateAltText('feature', appName, featureText),
      featureText,
      usedScreenshots: false,
    };
  }

  /**
   * Generate a feature image guided by real app screenshots (the compliant,
   * Shopify-4.4.4 primary path). If the screenshot-guided call fails or the
   * model returns no image, fall back to prompt-only generation with
   * `usedScreenshots: false` — never silently: the route reads that flag and
   * raises a compliance warning.
   */
  async function generateFeatureImageWithScreenshots(
    options: ImagenGenerateWithScreenshotsOptions
  ): Promise<ImagenGeneratedImage> {
    const { appName, featureText, description, screenshots } = options;

    if (!screenshots || screenshots.length === 0) {
      return generateFeatureImage(appName, featureText, description);
    }

    const prompt = buildScreenshotPrompt(appName, featureText, description);
    try {
      const { buffer, mimeType } = await generateWithGemini({
        prompt,
        type: 'feature',
        screenshots: screenshots.slice(0, 3),
      });
      return {
        id: `gemini-feature-${Date.now()}`,
        buffer,
        mimeType,
        width: SHOPIFY_IMAGE_SPECS.featureImage.width,
        height: SHOPIFY_IMAGE_SPECS.featureImage.height,
        type: 'feature',
        prompt,
        altText: generateAltText('feature', appName, featureText),
        featureText,
        usedScreenshots: true,
      };
    } catch {
      // Screenshot-guided generation failed — degrade to prompt-only.
      const fallback = await generateFeatureImage(appName, featureText, description);
      return { ...fallback, usedScreenshots: false };
    }
  }

  async function generateAllImages(
    appName: string,
    appDescription: string,
    features: string[],
    screenshots?: ReferenceScreenshot[]
  ): Promise<ImagenGeneratedImage[]> {
    // App icon is always logo-style (no screenshots).
    const icon = await generateAppIcon(appName, appDescription);

    const featuresToGenerate = features.filter((f) => f.trim()).slice(0, 3);
    const hasScreenshots = Boolean(screenshots && screenshots.length > 0);

    const featureImagePromises = featuresToGenerate.map((feature, index) => {
      if (hasScreenshots) {
        return generateFeatureImageWithScreenshots({
          appName,
          featureText: feature,
          description: appDescription,
          screenshots: selectScreenshotSubset(screenshots!, index),
        });
      }
      return generateFeatureImage(appName, feature, appDescription);
    });

    const featureImages = await Promise.all(featureImagePromises);
    return [icon, ...featureImages];
  }

  return {
    generateAppIcon,
    generateFeatureImage,
    generateFeatureImageWithScreenshots,
    generateAllImages,
  };
}
