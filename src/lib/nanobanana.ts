import { IMAGE_SPECS, FORBIDDEN_PATTERNS } from './validators/constants';
import type { ImageType, ImageFormat } from './validators/image';

const POLLINATIONS_API_BASE = 'https://image.pollinations.ai/prompt';
const DEFAULT_TIMEOUT = 120000;
const MAX_PROMPT_LENGTH = 2000;

export type { ImageType, ImageFormat };
export type ImageStyle = 'flat' | 'modern' | 'gradient' | 'minimalist' | '3d';

export interface ImageGenerationRequest {
  type: ImageType;
  prompt: string;
  style?: ImageStyle;
  featureHighlight?: string;
  negativePrompt?: string;
}

export interface GeneratedImageResult {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  width?: number;
  height?: number;
  format?: ImageFormat;
  error?: string;
  progress?: number;
}

export interface JobStatus {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  imageUrl?: string;
  error?: string;
}

export interface VersionInfo {
  version: string;
  releaseDate: string;
  features: string[];
}

export interface GenerateOptions {
  pollInterval?: number;
  timeout?: number;
}

export interface BatchOptions {
  concurrentLimit?: number;
}

export class NanoBananaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'NanoBananaError';
  }
}

export interface NanoBananaClient {
  generateImage(
    request: ImageGenerationRequest,
    options?: GenerateOptions
  ): Promise<GeneratedImageResult>;
  generateBatch(
    requests: ImageGenerationRequest[],
    options?: BatchOptions
  ): Promise<GeneratedImageResult[]>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  checkVersion(): Promise<VersionInfo>;
  regenerateImage(imageId: string): Promise<GeneratedImageResult>;
}

function getImageDimensions(type: ImageType): { width: number; height: number } {
  switch (type) {
    case 'icon':
      return { width: IMAGE_SPECS.ICON.width, height: IMAGE_SPECS.ICON.height };
    case 'feature':
      return { width: IMAGE_SPECS.FEATURE.width, height: IMAGE_SPECS.FEATURE.height };
    default:
      throw new NanoBananaError(`Invalid image type: ${type}`);
  }
}

function validateImageType(type: string): type is ImageType {
  return type === 'icon' || type === 'feature';
}

/**
 * Creates a Pollinations.ai client for image generation.
 * Pollinations.ai is a FREE API that doesn't require authentication.
 * @param apiKey - Optional API key (kept for backwards compatibility, not used)
 * @returns NanoBananaClient interface for image generation
 */
export function createNanoBananaClient(_apiKey?: string): NanoBananaClient {
  // Pollinations.ai is FREE and doesn't require an API key
  // We keep the apiKey parameter for backwards compatibility but don't use it

  /**
   * Generates an image using Pollinations.ai free API
   * @param request - Image generation parameters including type, prompt, and style
   * @param options - Optional configuration including timeout
   * @returns Promise resolving to generated image result with URL and metadata
   * @throws {NanoBananaError} If validation fails or generation errors occur
   */
  async function generateImage(
    request: ImageGenerationRequest,
    options: GenerateOptions = {}
  ): Promise<GeneratedImageResult> {
    if (!validateImageType(request.type)) {
      throw new NanoBananaError(`Invalid image type: ${request.type}`);
    }

    if (!request.prompt || request.prompt.trim() === '') {
      throw new NanoBananaError('Prompt is required');
    }

    if (request.prompt.length > MAX_PROMPT_LENGTH) {
      throw new NanoBananaError(`Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`);
    }

    if (FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test(request.prompt)) {
      throw new NanoBananaError('Prompt cannot contain Shopify branding');
    }

    const dimensions = getImageDimensions(request.type);
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    // Build enhanced prompt with style and negative patterns
    const styleModifier = request.style ? `, ${request.style} style` : '';
    const negativePatterns =
      request.negativePrompt || 'blurry, low quality, text, watermark, logo, shopify branding';
    const enhancedPrompt = `${request.prompt}${styleModifier}, no ${negativePatterns}`;

    // Generate seed for consistent style (use timestamp + random for uniqueness)
    const seed = Math.floor(Math.random() * 1000000);

    // Build Pollinations.ai URL (FREE API - no authentication needed)
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const pollinationsUrl = `${POLLINATIONS_API_BASE}/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&seed=${seed}&nologo=true&enhance=true`;

    // Generate unique job ID for tracking
    const jobId = `pollinations-${request.type}-${Date.now()}-${seed}`;

    // Create AbortController for proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Fetch image from Pollinations.ai with timeout support
      const response = await fetch(pollinationsUrl, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NanoBananaError(
          `Pollinations.ai API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      // Verify it's an image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('image')) {
        throw new NanoBananaError('Response is not an image');
      }

      // Return the direct image URL (Pollinations.ai returns the image directly)
      return {
        jobId,
        status: 'completed',
        imageUrl: pollinationsUrl,
        width: dimensions.width,
        height: dimensions.height,
        format: 'png',
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof NanoBananaError) {
        throw error;
      }

      // Handle AbortController timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NanoBananaError('Image generation timed out');
      }

      throw new NanoBananaError(
        `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async function generateBatch(
    requests: ImageGenerationRequest[],
    options: BatchOptions = {}
  ): Promise<GeneratedImageResult[]> {
    const concurrentLimit = options.concurrentLimit || 3;
    const results: GeneratedImageResult[] = [];

    for (let i = 0; i < requests.length; i += concurrentLimit) {
      const batch = requests.slice(i, i + concurrentLimit);
      const batchPromises = batch.map((req) => generateImage(req));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async function getJobStatus(jobId: string): Promise<JobStatus> {
    // Pollinations.ai generates images synchronously, so all jobs are either completed or failed
    // Parse the jobId to check if it's a valid Pollinations job
    if (!jobId.startsWith('pollinations-')) {
      throw new NanoBananaError('Invalid job ID');
    }

    // Since Pollinations.ai is synchronous, we can only return completed status
    return {
      jobId,
      status: 'completed',
      progress: 100,
    };
  }

  async function checkVersion(): Promise<VersionInfo> {
    // Pollinations.ai doesn't have versioning - return static info
    return {
      version: '1.0.0',
      releaseDate: new Date().toISOString(),
      features: ['Free API', 'No authentication required', 'Direct image generation'],
    };
  }

  /**
   * Regenerates an existing image with a new seed while preserving the original prompt
   * @param imageId - The ID of the image to regenerate
   * @returns Promise resolving to the newly generated image result
   * @throws {NanoBananaError} If image is not found or generation fails
   */
  async function regenerateImage(imageId: string): Promise<GeneratedImageResult> {
    // Import db operations and connection dynamically to avoid circular dependencies
    const { getImageById, updateImage } = await import('./db/images');
    const { getDatabaseConnected } = await import('./mongodb');
    const db = await getDatabaseConnected();

    // Get original image metadata
    const originalImage = await getImageById(db, imageId);
    if (!originalImage) {
      throw new NanoBananaError('Image not found');
    }

    // Regenerate with same prompt and dimensions
    const request: ImageGenerationRequest = {
      type: originalImage.type,
      prompt: originalImage.generationPrompt,
      featureHighlight: originalImage.featureHighlighted,
    };

    const result = await generateImage(request);

    // Update database with new image data and increment version
    await updateImage(db, imageId, {
      driveUrl: result.imageUrl || '',
      driveFileId: result.jobId,
      version: originalImage.version + 1,
    });

    return result;
  }

  return {
    generateImage,
    generateBatch,
    getJobStatus,
    checkVersion,
    regenerateImage,
  };
}
