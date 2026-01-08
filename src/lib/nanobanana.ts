import { IMAGE_SPECS, FORBIDDEN_PATTERNS } from './validators/constants';
import type { ImageType, ImageFormat } from './validators/image';

const NANOBANANA_API_BASE = 'https://api.nanobanana.io/v1';
const MAX_RETRIES = 3;
const DEFAULT_POLL_INTERVAL = 1000;
const DEFAULT_TIMEOUT = 120000;
const INITIAL_RETRY_DELAY = 1000;

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  apiKey: string,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<Response> {
  let lastError: Error | null = null;

  const headers = {
    ...((options.headers as Record<string, string>) || {}),
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        delay *= 2;
        continue;
      }

      if (response.status >= 500 && attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      const errorBody = await response.json().catch(() => ({}));
      throw new NanoBananaError(errorBody?.error || response.statusText, response.status);
    } catch (error) {
      if (error instanceof NanoBananaError) {
        throw error;
      }
      lastError = error as Error;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw new NanoBananaError(lastError?.message || 'Request failed after retries');
}

export function createNanoBananaClient(apiKey: string): NanoBananaClient {
  if (!apiKey || apiKey.trim() === '') {
    throw new NanoBananaError('API key is required');
  }

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

    if (FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test(request.prompt)) {
      throw new NanoBananaError('Prompt cannot contain Shopify branding');
    }

    const dimensions = getImageDimensions(request.type);
    const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    const requestBody = {
      prompt: request.prompt,
      width: dimensions.width,
      height: dimensions.height,
      style: request.style || 'modern',
      negativePrompt:
        request.negativePrompt || 'blurry, low quality, text, watermark, logo, shopify',
      featureHighlight: request.featureHighlight,
    };

    const startResponse = await fetchWithRetry(
      `${NANOBANANA_API_BASE}/generate`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      apiKey
    );

    const startData = await startResponse.json();
    const jobId = startData.jobId;

    if (startData.status === 'completed') {
      return {
        jobId,
        status: 'completed',
        imageUrl: startData.imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        format: 'png',
      };
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const status = await getJobStatus(jobId);

      if (status.status === 'completed') {
        return {
          jobId,
          status: 'completed',
          imageUrl: status.imageUrl,
          width: dimensions.width,
          height: dimensions.height,
          format: 'png',
        };
      }

      if (status.status === 'failed') {
        throw new NanoBananaError(status.error || 'Image generation failed');
      }
    }

    throw new NanoBananaError('Image generation timed out');
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
    const response = await fetchWithRetry(
      `${NANOBANANA_API_BASE}/jobs/${jobId}`,
      { method: 'GET' },
      apiKey
    );

    return response.json();
  }

  async function checkVersion(): Promise<VersionInfo> {
    const response = await fetchWithRetry(
      `${NANOBANANA_API_BASE}/version`,
      { method: 'GET' },
      apiKey
    );

    return response.json();
  }

  return {
    generateImage,
    generateBatch,
    getJobStatus,
    checkVersion,
  };
}
