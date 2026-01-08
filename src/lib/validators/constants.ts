export const SHOPIFY_LIMITS = {
  APP_NAME_MAX: 30,
  APP_INTRODUCTION_MAX: 100,
  APP_DESCRIPTION_MAX: 500,
  FEATURE_ITEM_MAX: 80,
  WORKS_WITH_MAX_ITEMS: 6,
  FEATURE_TAGS_MAX_ITEMS: 25,
  MIN_FEATURE_IMAGES: 5,
} as const;

export const IMAGE_SPECS = {
  ICON: { width: 1200, height: 1200 },
  FEATURE: { width: 1600, height: 900 },
  MAX_FILE_SIZE_MB: 20,
  SAFE_ZONE_PX: 100,
  MIN_CONTRAST_RATIO: 4.5,
  ALLOWED_FORMATS: ['png', 'jpeg', 'jpg'] as const,
} as const;

export const FORBIDDEN_PATTERNS = {
  CONTACT_INFO: /\b(email|phone|contact us|call|@|\.(com|org|net|io))\b/i,
  UNVERIFIABLE_CLAIMS: /(^|\s)(best|first|#1|number one|top rated|leading|only)(\s|$|[.,!?])/i,
  SHOPIFY_BRANDING: /\bshopify\b/i,
} as const;

export const SHOPIFY_CATEGORIES = [
  'Store design',
  'Marketing',
  'Sales and conversion',
  'Orders and shipping',
  'Inventory management',
  'Customer support',
  'Trust and security',
  'Finances',
  'Productivity',
  'Sourcing and selling products',
  'Store management',
  'Reporting',
] as const;

export type ShopifyCategory = (typeof SHOPIFY_CATEGORIES)[number];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const SHOPIFY_INTEGRATIONS = [
  'Shopify POS',
  'Shopify Flow',
  'Shopify Checkout',
  'Shopify Markets',
  'Shopify B2B',
  'Shopify Subscriptions',
] as const;

export type ShopifyIntegration = (typeof SHOPIFY_INTEGRATIONS)[number];
