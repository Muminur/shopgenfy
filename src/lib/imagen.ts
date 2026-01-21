import { GoogleGenAI } from '@google/genai';

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

export interface ImagenGenerateOptions {
  prompt: string;
  type: 'icon' | 'feature';
  numberOfImages?: number;
  negativePrompt?: string;
}

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

export interface ImagenGeneratedImage {
  id: string;
  url: string;
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  type: 'icon' | 'feature';
  prompt: string;
  altText: string;
}

export interface ImagenGenerateResult {
  images: ImagenGeneratedImage[];
  model: string;
  generatedAt: string;
}

export class ImagenError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ImagenError';
  }
}

export interface ImagenClient {
  generateImages(options: ImagenGenerateOptions): Promise<ImagenGenerateResult>;
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

export function createImagenClient(apiKey: string): ImagenClient {
  if (!apiKey || apiKey.trim() === '') {
    throw new ImagenError('API key is required');
  }

  const ai = new GoogleGenAI({ apiKey });

  async function generateImages(options: ImagenGenerateOptions): Promise<ImagenGenerateResult> {
    const { prompt, type, numberOfImages = 1, negativePrompt } = options;

    if (!prompt || prompt.trim() === '') {
      throw new ImagenError('Prompt is required');
    }

    const spec = type === 'icon' ? SHOPIFY_IMAGE_SPECS.appIcon : SHOPIFY_IMAGE_SPECS.featureImage;

    // Build the enhanced prompt with Shopify compliance
    const enhancedPrompt = [
      prompt,
      'Professional quality, high resolution',
      'Clean modern design, no text overlays',
      'No Shopify logos or branding',
      'No browser chrome or UI frames',
      'Solid background with good contrast',
    ].join('. ');

    // Note: negativePrompt parameter is not supported in current Gemini API for Imagen
    // Negative elements are included in the main prompt above instead
    void negativePrompt; // Acknowledge parameter for future API support

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: enhancedPrompt,
        config: {
          numberOfImages,
          aspectRatio: spec.aspectRatio,
          outputMimeType: 'image/png',
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new ImagenError('No images were generated');
      }

      const images: ImagenGeneratedImage[] = response.generatedImages.map((img, index) => {
        const imageBytes = img.image?.imageBytes;
        if (!imageBytes) {
          throw new ImagenError(`Image ${index + 1} has no data`);
        }

        const base64Data =
          typeof imageBytes === 'string' ? imageBytes : Buffer.from(imageBytes).toString('base64');

        return {
          id: `imagen-${type}-${Date.now()}-${index}`,
          url: `data:image/png;base64,${base64Data}`,
          base64Data,
          mimeType: 'image/png',
          width: spec.width,
          height: spec.height,
          type,
          prompt: options.prompt,
          altText: generateAltText(type, 'App', undefined),
        };
      });

      return {
        images,
        model: 'imagen-4.0-generate-001',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ImagenError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Image generation failed';
      throw new ImagenError(message, 'GENERATION_FAILED', error);
    }
  }

  async function generateAppIcon(
    appName: string,
    description?: string
  ): Promise<ImagenGeneratedImage> {
    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';

    const prompt = [
      `Professional app icon for "${sanitizedName}"`,
      sanitizedDesc ? `App concept: ${sanitizedDesc.slice(0, 100)}` : '',
      'Style: modern flat design, minimalist, simple geometric shapes',
      'Bold vibrant colors, single focal point, centered composition',
      'Square format suitable for app store listing',
      'Clean edges, professional look',
    ]
      .filter(Boolean)
      .join('. ');

    const result = await generateImages({
      prompt,
      type: 'icon',
      numberOfImages: 1,
    });

    const image = result.images[0];
    image.altText = generateAltText('icon', appName);
    return image;
  }

  async function generateFeatureImage(
    appName: string,
    featureText: string,
    description?: string
  ): Promise<ImagenGeneratedImage> {
    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedFeature = sanitizeForPrompt(featureText);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';

    const prompt = [
      `Feature showcase image for "${sanitizedName}" app`,
      `Highlighting: "${sanitizedFeature}"`,
      sanitizedDesc ? `App context: ${sanitizedDesc.slice(0, 100)}` : '',
      'Style: modern UI mockup, clean interface visualization',
      'Professional dashboard or app screen representation',
      'High contrast, clear visual hierarchy',
      '16:9 widescreen format, suitable for app store gallery',
    ]
      .filter(Boolean)
      .join('. ');

    const result = await generateImages({
      prompt,
      type: 'feature',
      numberOfImages: 1,
    });

    const image = result.images[0];
    image.altText = generateAltText('feature', appName, featureText);
    return image;
  }

  /**
   * Generate feature image using actual screenshots from the user's app as reference.
   * Uses Gemini's multimodal image generation (gemini-2.5-flash-image) to create
   * a Shopify App Store compliant feature image that incorporates the real app screenshots.
   */
  async function generateFeatureImageWithScreenshots(
    options: ImagenGenerateWithScreenshotsOptions
  ): Promise<ImagenGeneratedImage> {
    const { appName, featureText, description, screenshots } = options;

    if (!screenshots || screenshots.length === 0) {
      // Fall back to regular generation if no screenshots provided
      return generateFeatureImage(appName, featureText, description);
    }

    const sanitizedName = sanitizeForPrompt(appName);
    const sanitizedFeature = sanitizeForPrompt(featureText);
    const sanitizedDesc = description ? sanitizeForPrompt(description) : '';

    // Build the prompt for Gemini multimodal image generation
    const textPrompt = [
      `Create a professional Shopify App Store feature image for "${sanitizedName}" app.`,
      `Feature to highlight: "${sanitizedFeature}"`,
      sanitizedDesc ? `App description: ${sanitizedDesc.slice(0, 150)}` : '',
      '',
      'IMPORTANT INSTRUCTIONS:',
      '- Use the provided screenshot(s) as the main visual content',
      '- Create a polished, professional app store listing image',
      '- Add subtle design elements like gradient backgrounds, device frames, or decorative elements',
      '- Ensure the screenshot is clearly visible and is the focal point',
      '- Add professional overlay text highlighting the feature (use clean sans-serif font)',
      '- Output dimensions should be 16:9 widescreen format (1600x900)',
      '- Use high contrast colors for good visibility',
      '- NO Shopify logos or branding',
      '- NO browser chrome or URL bars',
      '- Keep ~100px safe zone from edges',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      // Build multimodal content with screenshots and text
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = [];

      // Add screenshots as inline images (max 3 for best results)
      const screenshotsToUse = screenshots.slice(0, 3);
      for (const screenshot of screenshotsToUse) {
        contentParts.push({
          inlineData: {
            mimeType: screenshot.mimeType,
            data: screenshot.base64,
          },
        });
      }

      // Add the text prompt
      contentParts.push({ text: textPrompt });

      // Use Gemini's multimodal image generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: contentParts,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      // Extract the generated image from response
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new ImagenError('No response generated from Gemini');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new ImagenError('No content parts in response');
      }

      // Find the image part in the response
      let imageBase64: string | undefined;
      let imageMimeType = 'image/png';

      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partAny = part as any;
        if (partAny.inlineData?.data) {
          imageBase64 = partAny.inlineData.data;
          imageMimeType = partAny.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!imageBase64) {
        // If Gemini didn't return an image, fall back to regular Imagen generation
        console.warn('Gemini did not return an image, falling back to Imagen');
        return generateFeatureImage(appName, featureText, description);
      }

      const spec = SHOPIFY_IMAGE_SPECS.featureImage;

      return {
        id: `gemini-feature-${Date.now()}-0`,
        url: `data:${imageMimeType};base64,${imageBase64}`,
        base64Data: imageBase64,
        mimeType: imageMimeType,
        width: spec.width,
        height: spec.height,
        type: 'feature',
        prompt: textPrompt,
        altText: generateAltText('feature', appName, featureText),
      };
    } catch (error) {
      if (error instanceof ImagenError) {
        throw error;
      }
      // Log the error and fall back to regular generation
      console.error('Gemini multimodal generation failed, falling back to Imagen:', error);
      return generateFeatureImage(appName, featureText, description);
    }
  }

  async function generateAllImages(
    appName: string,
    appDescription: string,
    features: string[],
    screenshots?: ReferenceScreenshot[]
  ): Promise<ImagenGeneratedImage[]> {
    // Generate app icon first (always uses Imagen, no screenshots needed)
    const icon = await generateAppIcon(appName, appDescription);

    // Generate feature images in parallel (max 3 to match Shopify recommendations)
    const featuresToGenerate = features.filter((f) => f.trim()).slice(0, 3);

    // If screenshots are provided, use multimodal generation
    // Otherwise, fall back to regular Imagen generation
    const hasScreenshots = screenshots && screenshots.length > 0;

    const featureImagePromises = featuresToGenerate.map((feature, index) => {
      if (hasScreenshots) {
        // Rotate through screenshots for different features
        const screenshotIndex = index % screenshots.length;
        const screenshotsForFeature = [
          screenshots[screenshotIndex],
          // Include additional screenshots for context if available
          ...screenshots.filter((_, i) => i !== screenshotIndex).slice(0, 2),
        ];

        return generateFeatureImageWithScreenshots({
          appName,
          featureText: feature,
          description: appDescription,
          screenshots: screenshotsForFeature,
        });
      }
      return generateFeatureImage(appName, feature, appDescription);
    });

    const featureImages = await Promise.all(featureImagePromises);

    return [icon, ...featureImages];
  }

  return {
    generateImages,
    generateAppIcon,
    generateFeatureImage,
    generateFeatureImageWithScreenshots,
    generateAllImages,
  };
}
