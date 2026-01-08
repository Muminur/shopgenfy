import { SHOPIFY_LIMITS } from './validators/constants';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-pro';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

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
  analyzeUrl(url: string): Promise<GeminiAnalysisResult>;
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

export function createGeminiClient(apiKey: string): GeminiClient {
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiError('API key is required');
  }

  const baseHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  async function listModels(options?: { filter?: string }): Promise<GeminiModel[]> {
    const url = `${GEMINI_API_BASE}/models`;

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
    const model = options.model || DEFAULT_MODEL;
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;

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
    const model = options.model || DEFAULT_MODEL;
    const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse`;

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

  async function analyzeUrl(url: string): Promise<GeminiAnalysisResult> {
    try {
      new URL(url);
    } catch {
      throw new GeminiError('Invalid URL format');
    }

    const prompt = `Analyze the following landing page URL and extract information for a Shopify App Store listing.
URL: ${url}

Extract and return a JSON object with these fields:
- appName: The app name (max 30 characters, should start with brand term)
- appIntroduction: A tagline (max 100 characters)
- appDescription: Description (max 500 characters, no contact info, no superlative claims)
- featureList: Array of key features (each max 80 characters)
- languages: Array of language codes the app supports
- primaryCategory: Main category (e.g., "Store design", "Marketing", "Sales")
- featureTags: Array of relevant tags (max 25)
- pricing: Object with type ("free", "freemium", "paid", "subscription") and optional price/currency/billingCycle
- confidence: Number from 0-1 indicating confidence in the extraction

Ensure all content follows Shopify App Store guidelines:
- No contact information in descriptions
- No unverifiable claims (best, first, #1, etc.)
- No Shopify branding references

Return ONLY the JSON object, no other text.`;

    const result = await generateContent(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    let analysis: GeminiAnalysisResult;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      throw new GeminiError('Failed to parse analysis response');
    }

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
      primaryCategory: analysis.primaryCategory || 'Store design',
      featureTags: (analysis.featureTags || []).slice(0, SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS),
      pricing: analysis.pricing || { type: 'free' },
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0)),
    };
  }

  return {
    listModels,
    generateContent,
    generateContentStream,
    analyzeUrl,
  };
}
