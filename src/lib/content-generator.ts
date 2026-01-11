import { createGeminiClient, GeminiError } from './gemini';
import {
  SHOPIFY_LIMITS,
  FORBIDDEN_PATTERNS,
  SUPERLATIVE_PATTERNS,
  CONTACT_INFO_PATTERNS,
} from './validators/constants';

export interface ContentGenerationInput {
  url: string;
  model?: string;
}

export interface GeneratedContent {
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
}

export interface ValidationIssue {
  field: string;
  type: 'superlative' | 'contact_info' | 'shopify_branding' | 'length_exceeded';
  message: string;
  severity: 'error' | 'warning';
}

export interface ContentValidation {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface ContentGenerationResult {
  success: boolean;
  content?: GeneratedContent;
  confidence?: number;
  error?: string;
  warnings?: string[];
  validation?: ContentValidation;
  suggestions?: string[];
}

export interface RegenerateFieldInput {
  field: keyof GeneratedContent | 'featureList';
  context: Partial<GeneratedContent>;
  instructions?: string;
}

export interface RegenerateFieldResult {
  success: boolean;
  value?: string | string[];
  error?: string;
}

export interface AltTextInput {
  imageType: 'icon' | 'feature';
  appName: string;
  featureHighlighted?: string;
  generationPrompt: string;
}

export interface AltTextResult {
  success: boolean;
  altText?: string;
  fallbackAltText?: string;
  error?: string;
}

export interface ContentGenerator {
  generateFromUrl(url: string): Promise<ContentGenerationResult>;
  regenerateField(input: RegenerateFieldInput): Promise<RegenerateFieldResult>;
  regenerateAnalysis(url: string): Promise<ContentGenerationResult>;
  generateAltText(input: AltTextInput): Promise<AltTextResult>;
}

function sanitizeText(text: string): string {
  if (!text) return '';
  return text.replace(FORBIDDEN_PATTERNS.SHOPIFY_BRANDING, '').replace(/\s+/g, ' ').trim();
}

function truncateToLimit(text: string, limit: number): string {
  const sanitized = sanitizeText(text);
  if (sanitized.length <= limit) return sanitized;
  return sanitized.substring(0, limit - 3) + '...';
}

function detectSuperlatives(text: string): boolean {
  return SUPERLATIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function detectContactInfo(text: string): boolean {
  return CONTACT_INFO_PATTERNS.some((pattern) => pattern.test(text));
}

function detectShopifyBranding(text: string): boolean {
  return FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test(text);
}

function validateContent(content: GeneratedContent): ContentValidation {
  const issues: ValidationIssue[] = [];

  // Check for Shopify branding
  const fieldsToCheck: (keyof GeneratedContent)[] = [
    'appName',
    'appIntroduction',
    'appDescription',
  ];

  for (const field of fieldsToCheck) {
    const value = content[field];
    if (typeof value === 'string') {
      if (detectShopifyBranding(value)) {
        issues.push({
          field,
          type: 'shopify_branding',
          message: `${field} contains Shopify branding which is not allowed`,
          severity: 'error',
        });
      }

      if (detectSuperlatives(value)) {
        issues.push({
          field,
          type: 'superlative',
          message: `${field} contains unverifiable superlative claims`,
          severity: 'warning',
        });
      }

      if (detectContactInfo(value)) {
        issues.push({
          field,
          type: 'contact_info',
          message: `${field} contains contact information which is not allowed`,
          severity: 'error',
        });
      }
    }
  }

  // Check feature list
  for (const feature of content.featureList) {
    if (detectSuperlatives(feature)) {
      issues.push({
        field: 'featureList',
        type: 'superlative',
        message: `Feature "${feature.substring(0, 30)}..." contains unverifiable claims`,
        severity: 'warning',
      });
    }
  }

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

function generateSuggestions(content: GeneratedContent, confidence: number): string[] {
  const suggestions: string[] = [];

  // Low confidence suggestions
  if (confidence < 0.5) {
    suggestions.push('Consider providing more detailed information on your landing page');
  }

  // Short content suggestions
  if (content.appName.length < 5) {
    suggestions.push('App name could be more descriptive');
  }

  if (content.appIntroduction.length < 20) {
    suggestions.push('App introduction could be more detailed');
  }

  if (content.appDescription.length < 100) {
    suggestions.push('App description should be more comprehensive');
  }

  if (content.featureList.length < 3) {
    suggestions.push('Consider adding more features to highlight');
  }

  if (content.featureTags.length < 3) {
    suggestions.push('Add more feature tags to improve discoverability');
  }

  if (content.languages.length < 2) {
    suggestions.push('Consider supporting multiple languages');
  }

  return suggestions;
}

function generateWarnings(content: GeneratedContent): string[] {
  const warnings: string[] = [];

  // Check for superlatives
  const allText = `${content.appName} ${content.appIntroduction} ${content.appDescription}`;
  if (detectSuperlatives(allText)) {
    warnings.push('Content contains superlative claims that may need revision');
  }

  // Check for contact info
  if (detectContactInfo(allText)) {
    warnings.push('Content contains contact information that should be removed');
  }

  return warnings;
}

export function createContentGenerator(apiKey: string): ContentGenerator {
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiError('API key is required');
  }

  const geminiClient = createGeminiClient(apiKey);

  async function generateFromUrl(url: string): Promise<ContentGenerationResult> {
    try {
      const analysis = await geminiClient.analyzeUrl(url);

      // Sanitize and truncate all content
      const content: GeneratedContent = {
        appName: truncateToLimit(analysis.appName, SHOPIFY_LIMITS.APP_NAME_MAX),
        appIntroduction: truncateToLimit(
          analysis.appIntroduction,
          SHOPIFY_LIMITS.APP_INTRODUCTION_MAX
        ),
        appDescription: truncateToLimit(
          analysis.appDescription,
          SHOPIFY_LIMITS.APP_DESCRIPTION_MAX
        ),
        featureList: analysis.featureList.map((f) =>
          truncateToLimit(f, SHOPIFY_LIMITS.FEATURE_ITEM_MAX)
        ),
        languages: analysis.languages,
        primaryCategory: analysis.primaryCategory,
        featureTags: analysis.featureTags.slice(0, SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS),
        pricing: analysis.pricing,
      };

      // Validate content
      const validation = validateContent(content);
      const warnings = generateWarnings(content);
      const suggestions = generateSuggestions(content, analysis.confidence);

      return {
        success: true,
        content,
        confidence: analysis.confidence,
        warnings,
        validation,
        suggestions,
      };
    } catch (error) {
      if (error instanceof GeminiError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Failed to generate content',
      };
    }
  }

  async function regenerateField(input: RegenerateFieldInput): Promise<RegenerateFieldResult> {
    const { field, context, instructions } = input;

    const fieldLimits: Record<string, number> = {
      appName: SHOPIFY_LIMITS.APP_NAME_MAX,
      appIntroduction: SHOPIFY_LIMITS.APP_INTRODUCTION_MAX,
      appDescription: SHOPIFY_LIMITS.APP_DESCRIPTION_MAX,
      featureList: SHOPIFY_LIMITS.FEATURE_ITEM_MAX,
    };

    const limit = fieldLimits[field] || 100;

    let prompt: string;

    if (field === 'featureList') {
      prompt = `Generate a list of 5 key features for an app named "${context.appName}" in the "${context.primaryCategory}" category.
${instructions ? `Additional instructions: ${instructions}` : ''}

Requirements:
- Each feature must be max ${SHOPIFY_LIMITS.FEATURE_ITEM_MAX} characters
- No superlative claims (best, first, #1)
- No Shopify branding
- Make features specific and actionable

Return ONLY a JSON array of strings, e.g. ["Feature 1", "Feature 2", ...]`;
    } else {
      const fieldDescriptions: Record<string, string> = {
        appName: `app name (max ${SHOPIFY_LIMITS.APP_NAME_MAX} chars, should start with brand term)`,
        appIntroduction: `tagline (max ${SHOPIFY_LIMITS.APP_INTRODUCTION_MAX} chars)`,
        appDescription: `description (max ${SHOPIFY_LIMITS.APP_DESCRIPTION_MAX} chars, no contact info)`,
      };

      prompt = `Generate a new ${fieldDescriptions[field] || field} for an app.
Current context:
- App name: ${context.appName || 'Unknown'}
- Category: ${context.primaryCategory || 'Unknown'}
- Description: ${context.appDescription?.substring(0, 100) || 'Not provided'}
${instructions ? `\nAdditional instructions: ${instructions}` : ''}

Requirements:
- No superlative claims (best, first, #1, etc.)
- No Shopify branding
- No contact information
- Max ${limit} characters

Return ONLY the new text, nothing else.`;
    }

    try {
      const result = await geminiClient.generateContent(prompt, {
        temperature: 0.7,
        maxOutputTokens: 500,
      });

      let value: string | string[];

      if (field === 'featureList') {
        try {
          const jsonMatch = result.text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            value = JSON.parse(jsonMatch[0]).map((f: string) =>
              truncateToLimit(f, SHOPIFY_LIMITS.FEATURE_ITEM_MAX)
            );
          } else {
            value = result.text
              .split('\n')
              .filter((line) => line.trim())
              .map((f) =>
                truncateToLimit(f.replace(/^[-*\d.]\s*/, ''), SHOPIFY_LIMITS.FEATURE_ITEM_MAX)
              )
              .slice(0, 10);
          }
        } catch (parseError) {
          console.warn('Failed to parse feature list as JSON, using fallback:', parseError);
          value = [truncateToLimit(result.text, SHOPIFY_LIMITS.FEATURE_ITEM_MAX)];
        }
      } else {
        value = truncateToLimit(result.text.trim(), limit);
      }

      return {
        success: true,
        value,
      };
    } catch (error) {
      if (error instanceof GeminiError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Failed to regenerate field',
      };
    }
  }

  async function regenerateAnalysis(url: string): Promise<ContentGenerationResult> {
    // Simply re-run the analysis with the same URL
    return generateFromUrl(url);
  }

  async function generateAltText(input: AltTextInput): Promise<AltTextResult> {
    const { imageType, appName, featureHighlighted, generationPrompt } = input;

    const prompt = `Generate a concise, descriptive alt text for accessibility (max 200 characters) for this ${imageType} image:

App Name: ${appName}
${featureHighlighted ? `Feature: ${featureHighlighted}` : ''}
Image Prompt: ${generationPrompt}

Requirements:
- Describe what's visually shown, not just labels
- No "image of" or "picture of" prefixes
- No Shopify branding
- Focus on content and purpose
- Maximum 200 characters

Return ONLY the alt text, nothing else.`;

    try {
      const result = await geminiClient.generateContent(prompt, {
        temperature: 0.5,
        maxOutputTokens: 100,
      });

      let altText = sanitizeText(result.text.trim());

      // Remove Shopify branding more aggressively
      altText = altText.replace(/\bshopify\b/gi, 'store');

      // Remove decorative prefixes
      altText = altText.replace(/^(image of|picture of|photo of|screenshot of)\s+/gi, '');

      // Truncate to 200 characters
      if (altText.length > 200) {
        altText = altText.substring(0, 197) + '...';
      }

      // Create fallback for good UX
      const fallbackAltText = featureHighlighted
        ? `${appName} - ${featureHighlighted}`
        : `${appName} app ${imageType}`;

      return {
        success: true,
        altText,
        fallbackAltText,
      };
    } catch (error) {
      const fallbackAltText = featureHighlighted
        ? `${appName} - ${featureHighlighted}`
        : `${appName} app ${imageType}`;

      if (error instanceof GeminiError) {
        return {
          success: false,
          error: error.message,
          fallbackAltText,
        };
      }
      return {
        success: false,
        error: 'Failed to generate alt text',
        fallbackAltText,
      };
    }
  }

  return {
    generateFromUrl,
    regenerateField,
    regenerateAnalysis,
    generateAltText,
  };
}
