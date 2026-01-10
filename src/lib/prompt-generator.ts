import { SHOPIFY_LIMITS, IMAGE_SPECS } from './validators/constants';

export interface PromptInput {
  appName: string;
  primaryCategory: string;
  features: string[];
  appDescription?: string;
}

export interface FeaturePromptInput {
  appName: string;
  feature: string;
  featureIndex: number;
}

export interface GeneratedPrompt {
  prompt: string;
  negativePrompt: string;
  type: 'icon' | 'feature';
  width: number;
  height: number;
  style: string;
  featureHighlighted?: string;
}

const STYLE_PRESET = 'modern, professional, clean design, high quality';

const NEGATIVE_PROMPT_BASE = [
  'text',
  'words',
  'letters',
  'watermark',
  'signature',
  'logo',
  'shopify',
  'brand logos',
  'company names',
  'blurry',
  'low quality',
  'distorted',
  'amateur',
  'cluttered',
].join(', ');

const DEFAULT_FEATURE_THEMES = [
  'Dashboard overview showing key metrics',
  'User-friendly interface with intuitive controls',
  'Real-time data visualization and analytics',
  'Seamless workflow automation',
  'Customizable settings and preferences',
];

/**
 * Sanitizes text for use in image prompts
 * Removes Shopify branding, URLs, and cleans whitespace
 */
export function sanitizePromptText(text: string): string {
  if (!text) return '';

  let sanitized = text
    // Remove Shopify branding (case insensitive)
    .replace(/shopify/gi, '')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate to max length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized;
}

/**
 * Generates an icon prompt for the app
 */
export function generateIconPrompt(input: PromptInput): GeneratedPrompt {
  const sanitizedAppName = sanitizePromptText(input.appName);
  const sanitizedCategory = sanitizePromptText(input.primaryCategory);

  const prompt = [
    `Professional app icon (${IMAGE_SPECS.ICON.width}x${IMAGE_SPECS.ICON.height}px)`,
    `for "${sanitizedAppName}"`,
    sanitizedCategory ? `a ${sanitizedCategory} application` : '',
    'Style: modern, flat design, minimalist, simple geometric shapes',
    'high contrast (4.5:1 ratio), vibrant colors',
    'single focal point, centered composition',
    'suitable for app store listing',
    'no text, no words, pure iconography',
  ]
    .filter(Boolean)
    .join('. ');

  return {
    prompt,
    negativePrompt: NEGATIVE_PROMPT_BASE,
    type: 'icon',
    width: IMAGE_SPECS.ICON.width,
    height: IMAGE_SPECS.ICON.height,
    style: STYLE_PRESET,
  };
}

/**
 * Generates a feature image prompt
 */
export function generateFeaturePrompt(input: FeaturePromptInput): GeneratedPrompt {
  const sanitizedAppName = sanitizePromptText(input.appName);
  let sanitizedFeature = sanitizePromptText(input.feature);

  // Truncate feature to Shopify limit
  if (sanitizedFeature.length > SHOPIFY_LIMITS.FEATURE_ITEM_MAX) {
    sanitizedFeature = sanitizedFeature.substring(0, SHOPIFY_LIMITS.FEATURE_ITEM_MAX - 3) + '...';
  }

  const prompt = [
    `Feature showcase image (${IMAGE_SPECS.FEATURE.width}x${IMAGE_SPECS.FEATURE.height}px)`,
    `for "${sanitizedAppName}" app`,
    `Highlighting: "${sanitizedFeature}"`,
    'Style: modern UI mockup, clean interface design',
    'professional dashboard or screen visualization',
    'high contrast, clear visual hierarchy',
    '16:9 aspect ratio, centered content with safe zones',
    'suitable for app store feature gallery',
  ]
    .filter(Boolean)
    .join('. ');

  return {
    prompt,
    negativePrompt: NEGATIVE_PROMPT_BASE,
    type: 'feature',
    width: IMAGE_SPECS.FEATURE.width,
    height: IMAGE_SPECS.FEATURE.height,
    style: STYLE_PRESET,
    featureHighlighted: sanitizedFeature,
  };
}

/**
 * Generates a batch of prompts for icon + feature images
 */
export function generateBatchPrompts(input: PromptInput): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];

  // Generate icon prompt
  prompts.push(generateIconPrompt(input));

  // Get features, use defaults if none provided
  let features = input.features.filter((f) => f.trim().length > 0);

  // If fewer than 5 features, pad with defaults
  if (features.length < SHOPIFY_LIMITS.MIN_FEATURE_IMAGES) {
    const defaultsNeeded = SHOPIFY_LIMITS.MIN_FEATURE_IMAGES - features.length;
    const category = input.primaryCategory || 'productivity';
    const defaultFeatures = DEFAULT_FEATURE_THEMES.slice(0, defaultsNeeded).map(
      (theme) => `${theme} for ${category} workflows`
    );
    features = [...features, ...defaultFeatures];
  }

  // Limit to max 10 features
  const maxFeatures = Math.min(features.length, 10);
  features = features.slice(0, maxFeatures);

  // Generate feature prompts
  features.forEach((feature, index) => {
    prompts.push(
      generateFeaturePrompt({
        appName: input.appName,
        feature,
        featureIndex: index,
      })
    );
  });

  return prompts;
}
