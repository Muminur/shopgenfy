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
  styleSeed?: string;
}

export interface StyleOptions {
  styleSeed?: string;
  useConsistentStyle?: boolean;
  preserveStyleSeed?: boolean;
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
 * Generates a deterministic style seed based on app name and category
 */
export function generateStyleSeed(appName: string, category: string): string {
  const normalized = `${appName}-${category}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const timestamp = Date.now().toString(36);
  return `${normalized}-${timestamp}`;
}

/**
 * Creates a simplified hash for consistent style generation
 */
function createSimpleHash(input: string): string {
  const normalized = input.toLowerCase().replace(/\s+/g, '-');
  return normalized.substring(0, 30);
}

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
export function generateIconPrompt(input: PromptInput, options?: StyleOptions): GeneratedPrompt {
  const sanitizedAppName = sanitizePromptText(input.appName);
  const sanitizedCategory = sanitizePromptText(input.primaryCategory);

  const styleSeed =
    options?.styleSeed || createSimpleHash(`${sanitizedAppName}-${sanitizedCategory}`);

  const prompt = [
    `Professional app icon (${IMAGE_SPECS.ICON.width}x${IMAGE_SPECS.ICON.height}px)`,
    `for "${sanitizedAppName}"`,
    sanitizedCategory ? `a ${sanitizedCategory} application` : '',
    'Style: modern, flat design, minimalist, simple geometric shapes',
    'high contrast (4.5:1 ratio), vibrant colors',
    'single focal point, centered composition',
    `style seed: ${styleSeed} for consistent visual identity`,
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
    styleSeed,
  };
}

/**
 * Generates a feature image prompt
 */
export function generateFeaturePrompt(
  input: FeaturePromptInput,
  options?: StyleOptions
): GeneratedPrompt {
  const sanitizedAppName = sanitizePromptText(input.appName);
  let sanitizedFeature = sanitizePromptText(input.feature);

  // Truncate feature to Shopify limit
  if (sanitizedFeature.length > SHOPIFY_LIMITS.FEATURE_ITEM_MAX) {
    sanitizedFeature = sanitizedFeature.substring(0, SHOPIFY_LIMITS.FEATURE_ITEM_MAX - 3) + '...';
  }

  const styleSeed = options?.styleSeed || createSimpleHash(`${sanitizedAppName}-feature`);

  const prompt = [
    `Feature showcase image (${IMAGE_SPECS.FEATURE.width}x${IMAGE_SPECS.FEATURE.height}px)`,
    `for "${sanitizedAppName}" app`,
    `Highlighting: "${sanitizedFeature}"`,
    'Style: modern UI mockup, clean interface design',
    'professional dashboard or screen visualization',
    'high contrast, clear visual hierarchy',
    `style seed: ${styleSeed} for consistent visual identity`,
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
    styleSeed,
  };
}

/**
 * Generates a batch of prompts for icon + feature images
 */
export function generateBatchPrompts(
  input: PromptInput,
  options?: StyleOptions
): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];

  // Generate or use consistent style seed for all images
  const styleSeed =
    options?.styleSeed ||
    (options?.useConsistentStyle
      ? createSimpleHash(`${input.appName}-${input.primaryCategory}`)
      : undefined);

  // Generate icon prompt
  prompts.push(generateIconPrompt(input, { styleSeed }));

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

  // Generate feature prompts with same style seed if consistency enabled
  features.forEach((feature, index) => {
    prompts.push(
      generateFeaturePrompt(
        {
          appName: input.appName,
          feature,
          featureIndex: index,
        },
        { styleSeed: options?.useConsistentStyle ? styleSeed : undefined }
      )
    );
  });

  return prompts;
}

/**
 * Generates a prompt with a specific style seed for consistency
 */
export function generatePromptWithStyleSeed(
  input: PromptInput,
  styleSeed?: string
): GeneratedPrompt {
  const generatedStyleSeed =
    styleSeed || createSimpleHash(`${input.appName}-${input.primaryCategory}`);

  return generateIconPrompt(input, { styleSeed: generatedStyleSeed });
}
