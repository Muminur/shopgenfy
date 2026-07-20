import { SHOPIFY_LIMITS, SHOPIFY_CATEGORIES } from './validators/constants';
import {
  fetchWebpageWithImages,
  WebpageFetchError,
  ExtractedImage,
  fetchImageAsBase64,
} from './webpage-fetcher';
import { resolveTextModel, markModelDead, isModelRetiredError } from './model-resolver';

const DEFAULT_GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

/**
 * Resolve the Gemini REST base URL at call time so `GEMINI_API_BASE` can be
 * overridden in tests / hermetic E2E (points at a local stub). Defaults to the
 * production endpoint.
 */
function getGeminiApiBase(): string {
  return process.env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE;
}

export interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

export interface GeminiGenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

export interface GeminiGenerateResult {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface GeminiStreamChunk {
  text: string;
  finishReason?: string;
}

export interface ExtractedScreenshot {
  /**
   * Source URL of the screenshot. Present for the URL analysis path; omitted
   * for sources (GitHub / uploads) where only the decoded bytes are carried.
   */
  url?: string;
  base64?: string;
  mimeType?: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Normalized, source-agnostic input to the shared analysis pipeline
 * (`analyzeContent`). Every input source — a website URL, a GitHub repo, a
 * pasted README, or an uploaded zip — is reduced to this shape so they share
 * one prompt / parse / truncate implementation.
 */
export interface PreparedContent {
  /** Short human title for the app/project (may be empty). */
  title: string;
  /** One-line description (may be empty). */
  description: string;
  /** The main text handed to the model (already length-capped by the source). */
  textContent: string;
  /** Pre-downloaded screenshot candidates as base64 bytes. */
  images: { base64: string; mimeType: string }[];
  /** Human-readable label naming the input type for the prompt preamble. */
  sourceLabel: string;
}

export interface GeminiAnalysisResult {
  appName: string;
  appIntroduction: string;
  appDescription: string;
  featureList: string[];
  languages: string[];
  primaryCategory: string;
  featureTags: string[];
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    price?: number;
    currency?: string;
    billingCycle?: 'monthly' | 'yearly' | 'one-time';
  };
  confidence: number;
  screenshots: ExtractedScreenshot[];
  /**
   * Human-readable notes about degraded behavior (e.g. a retired model was
   * skipped in favor of a fallback). Empty when the primary path succeeded.
   */
  warnings?: string[];
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GeminiClient {
  listModels(options?: { filter?: string }): Promise<GeminiModel[]>;
  generateContent(prompt: string, options?: GeminiGenerateOptions): Promise<GeminiGenerateResult>;
  generateContentStream(
    prompt: string,
    options?: GeminiGenerateOptions
  ): AsyncGenerator<GeminiStreamChunk>;
  analyzeUrl(url: string, options?: { model?: string }): Promise<GeminiAnalysisResult>;
  analyzeContent(
    content: PreparedContent,
    options?: { model?: string }
  ): Promise<GeminiAnalysisResult>;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

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
      const requestId =
        typeof response.headers.get === 'function' ? response.headers.get('x-request-id') : null;
      throw new GeminiError(
        errorBody?.error?.message || response.statusText,
        response.status,
        requestId || undefined
      );
    } catch (error) {
      if (error instanceof GeminiError) {
        throw error;
      }
      lastError = error as Error;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw new GeminiError(lastError?.message || 'Request failed after retries');
}

function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.substring(0, limit - 3) + '...';
}

/**
 * Coerce a model-supplied category label to a canonical Shopify category so an
 * approximate value from analysis can never poison the form's category select.
 *
 * Matching order: exact (case-insensitive) → prefix in either direction
 * (canonical starts with the raw label, e.g. `"Sales"` → `"Sales and
 * conversion"`, or the raw label starts with a canonical, e.g.
 * `"Marketing and SEO"` → `"Marketing"`) → empty string when nothing fits.
 */
export function matchShopifyCategory(raw?: string): string {
  if (!raw) return '';
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return '';

  const exact = SHOPIFY_CATEGORIES.find((c) => c.toLowerCase() === normalized);
  if (exact) return exact;

  const prefix = SHOPIFY_CATEGORIES.find((c) => {
    const lower = c.toLowerCase();
    return lower.startsWith(normalized) || normalized.startsWith(lower);
  });
  return prefix ?? '';
}

/**
 * Build the Shopify-listing extraction prompt from source-agnostic content.
 * Shared by every input source; the `sourceLabel` preamble tells the model
 * what kind of input it is looking at (website, GitHub repo, pasted source).
 */
function buildAnalysisPrompt(content: PreparedContent): string {
  const sourceLine = content.sourceLabel ? `SOURCE: ${content.sourceLabel}\n` : '';
  const titleLine = content.title ? `TITLE: ${content.title}\n` : '';
  const descriptionLine = content.description ? `DESCRIPTION: ${content.description}\n` : '';

  return `Analyze the following content and extract information for a Shopify App Store listing.

${sourceLine}${titleLine}${descriptionLine}
CONTENT:
${content.textContent}

---

Based on the above content, extract and return a JSON object with these fields:
- appName: The app name (max 30 characters, should start with brand term)
- appIntroduction: A tagline (max 100 characters)
- appDescription: Description (max 500 characters, no contact info, no superlative claims)
- featureList: Array of key features (each max 80 characters)
- languages: Array of language codes the app supports (default to ["en"] if unclear)
- primaryCategory: Main category (e.g., "Store design", "Marketing", "Sales")
- featureTags: Array of relevant tags (max 25)
- pricing: Object with type ("free", "freemium", "paid", "subscription") and optional price/currency/billingCycle
- confidence: Number from 0-1 indicating confidence in the extraction

Ensure all content follows Shopify App Store guidelines:
- No contact information in descriptions
- No unverifiable claims (best, first, #1, etc.)
- No Shopify branding references

Return ONLY the JSON object, no other text.`;
}

export function createGeminiClient(apiKey: string): GeminiClient {
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiError('API key is required');
  }

  const baseHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  async function listModels(options?: { filter?: string }): Promise<GeminiModel[]> {
    const url = `${getGeminiApiBase()}/models`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: baseHeaders,
    });

    const data = await response.json();
    let models: GeminiModel[] = data.models || [];

    if (options?.filter) {
      models = models.filter((model: GeminiModel) =>
        model.supportedGenerationMethods.includes(options.filter!)
      );
    }

    return models;
  }

  async function generateContent(
    prompt: string,
    options: GeminiGenerateOptions = {}
  ): Promise<GeminiGenerateResult> {
    const model = resolveTextModel(options.model);
    const url = `${getGeminiApiBase()}/models/${model}:generateContent`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.9,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
        stopSequences: options.stopSequences,
        ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      },
    };

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(`Content blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new GeminiError('No response generated');
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new GeminiError('Content blocked due to safety concerns');
    }

    const text = candidate.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('');

    return {
      text: text || '',
      finishReason: candidate.finishReason || 'STOP',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async function* generateContentStream(
    prompt: string,
    options: GeminiGenerateOptions = {}
  ): AsyncGenerator<GeminiStreamChunk> {
    const model = resolveTextModel(options.model);
    const url = `${getGeminiApiBase()}/models/${model}:streamGenerateContent?alt=sse`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.9,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
      },
    };

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(requestBody),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new GeminiError('Failed to get stream reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              const candidate = data.candidates?.[0];
              if (candidate?.content?.parts?.[0]?.text) {
                yield {
                  text: candidate.content.parts[0].text,
                  finishReason: candidate.finishReason,
                };
              }
            } catch {
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Shared analysis pipeline for every input source. Builds the extraction
   * prompt from `content`, calls the model (resolving/retrying across retired
   * models and recording a warning on fallback), parses the JSON, and applies
   * the Shopify field limits. Pre-downloaded `content.images` are surfaced as
   * `screenshots` (base64 only) for the image-generation pipeline.
   */
  async function analyzeContent(
    content: PreparedContent,
    options?: { model?: string }
  ): Promise<GeminiAnalysisResult> {
    if (!content.textContent || content.textContent.trim().length < 50) {
      throw new GeminiError('Page has insufficient content to analyze');
    }

    const prompt = buildAnalysisPrompt(content);
    const warnings: string[] = [];

    // JSON-hardened generation config: enforce a JSON response and give the
    // model enough output budget for the full listing. No thinking config —
    // 3.x models reject a blanket thinkingBudget.
    const generationOptions: GeminiGenerateOptions = {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    };

    // Resolve the text model dynamically. If the resolved model has been
    // retired upstream, mark it dead and retry once with the next candidate so
    // the analysis self-heals across Google's rolling model deprecations.
    const model = resolveTextModel(options?.model);
    let result: GeminiGenerateResult;
    try {
      result = await generateContent(prompt, { ...generationOptions, model });
    } catch (error) {
      if (
        error instanceof GeminiError &&
        isModelRetiredError(error.statusCode ?? 0, error.message)
      ) {
        markModelDead(model);
        const fallback = resolveTextModel(options?.model);
        if (fallback === model) {
          throw error;
        }
        warnings.push(`Model ${model} unavailable; used ${fallback}`);
        result = await generateContent(prompt, { ...generationOptions, model: fallback });
      } else {
        throw error;
      }
    }

    let analysis: Omit<GeminiAnalysisResult, 'screenshots'>;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      throw new GeminiError('Failed to parse analysis response');
    }

    // Pre-downloaded screenshot candidates carry only bytes (no source URL).
    const screenshots: ExtractedScreenshot[] = content.images.map((img) => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }));

    return {
      appName: truncateToLimit(analysis.appName || '', SHOPIFY_LIMITS.APP_NAME_MAX),
      appIntroduction: truncateToLimit(
        analysis.appIntroduction || '',
        SHOPIFY_LIMITS.APP_INTRODUCTION_MAX
      ),
      appDescription: truncateToLimit(
        analysis.appDescription || '',
        SHOPIFY_LIMITS.APP_DESCRIPTION_MAX
      ),
      featureList: (analysis.featureList || []).map((f: string) =>
        truncateToLimit(f, SHOPIFY_LIMITS.FEATURE_ITEM_MAX)
      ),
      languages: analysis.languages || ['en'],
      primaryCategory: matchShopifyCategory(analysis.primaryCategory),
      featureTags: (analysis.featureTags || []).slice(0, SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS),
      pricing: analysis.pricing || { type: 'free' },
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0)),
      screenshots,
      warnings,
    };
  }

  async function analyzeUrl(
    url: string,
    options?: { model?: string }
  ): Promise<GeminiAnalysisResult> {
    try {
      new URL(url);
    } catch {
      throw new GeminiError('Invalid URL format');
    }

    // Fetch the webpage content AND images
    let pageContent: string;
    let extractedImages: ExtractedImage[] = [];
    try {
      const fetched = await fetchWebpageWithImages(url, { maxLength: 12000 });
      pageContent = fetched.text;
      extractedImages = fetched.images;
    } catch (error) {
      if (error instanceof WebpageFetchError) {
        throw new GeminiError(`Failed to fetch page: ${error.message}`, error.statusCode);
      }
      throw new GeminiError('Failed to fetch page content');
    }

    // Run the shared pipeline. The URL path assembles its own rich screenshot
    // objects below (preserving source url/alt/dimensions), so no images are
    // handed to analyzeContent here.
    const analysis = await analyzeContent(
      {
        title: '',
        description: '',
        textContent: pageContent,
        images: [],
        sourceLabel: url,
      },
      options
    );

    // Fetch the top screenshots as base64 (max 5 to limit bandwidth)
    const screenshotsToFetch = extractedImages.slice(0, 5);
    const screenshotPromises = screenshotsToFetch.map(async (img): Promise<ExtractedScreenshot> => {
      const base64Data = await fetchImageAsBase64(img.url);
      return {
        url: img.url,
        base64: base64Data?.base64,
        mimeType: base64Data?.mimeType,
        alt: img.alt,
        width: img.width,
        height: img.height,
      };
    });

    const screenshots = await Promise.all(screenshotPromises);
    // Filter to only include screenshots that were successfully fetched
    const validScreenshots = screenshots.filter((s) => s.base64 && s.mimeType);

    return {
      ...analysis,
      screenshots: validScreenshots,
    };
  }

  return {
    listModels,
    generateContent,
    generateContentStream,
    analyzeUrl,
    analyzeContent,
  };
}
