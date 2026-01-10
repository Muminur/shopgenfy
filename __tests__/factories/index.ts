import type {
  Submission,
  GeneratedImage,
  User,
  PricingConfig,
  APIVersion,
  SubmissionStatus,
} from '@/types';

// Counter for generating unique IDs
let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `test-id-${idCounter}-${Date.now()}`;
}

// Default values that comply with Shopify limits
const DEFAULT_APP_NAME = 'TestApp'; // max 30 chars
const DEFAULT_APP_INTRO = 'A test application for development'; // max 100 chars
const DEFAULT_APP_DESC =
  'This is a test application created for development and testing purposes. It demonstrates the core functionality of the submission system.'; // max 500 chars

const DEFAULT_FEATURES = [
  'Easy to use interface', // max 80 chars each
  'Fast performance',
  'Secure data handling',
];

const DEFAULT_LANGUAGES = ['en'];
const DEFAULT_WORKS_WITH = ['Shopify POS']; // max 6 items
const DEFAULT_FEATURE_TAGS = ['productivity', 'automation']; // max 25 items

export function createPricingConfigFactory(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    type: 'free',
    ...overrides,
  };
}

export function createSubmissionFactory(overrides: Partial<Submission> = {}): Submission {
  const now = new Date();

  return {
    id: generateId(),
    userId: generateId(),
    appName: DEFAULT_APP_NAME,
    appIntroduction: DEFAULT_APP_INTRO,
    appDescription: DEFAULT_APP_DESC,
    featureList: DEFAULT_FEATURES,
    languages: DEFAULT_LANGUAGES,
    worksWith: DEFAULT_WORKS_WITH,
    primaryCategory: 'Marketing',
    secondaryCategory: undefined,
    featureTags: DEFAULT_FEATURE_TAGS,
    pricing: createPricingConfigFactory(),
    landingPageUrl: 'https://example.com',
    status: 'draft' as SubmissionStatus,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createGeneratedImageFactory(
  overrides: Partial<GeneratedImage> = {}
): GeneratedImage {
  const type = overrides.type || 'feature';
  const isIcon = type === 'icon';

  // Set correct dimensions based on type
  const width = overrides.width ?? (isIcon ? 1200 : 1600);
  const height = overrides.height ?? (isIcon ? 1200 : 900);

  return {
    id: generateId(),
    submissionId: generateId(),
    type,
    driveFileId: `drive-file-${generateId()}`,
    driveUrl: `https://drive.google.com/file/d/${generateId()}/view`,
    width,
    height,
    format: 'png',
    generationPrompt: 'Test prompt for image generation',
    featureHighlighted: 'Test feature',
    altText: 'Test alt text for accessibility',
    version: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createUserFactory(overrides: Partial<User> = {}): User {
  const id = generateId();
  const now = new Date();

  return {
    id,
    email: `test-${id}@example.com`,
    selectedGeminiModel: 'gemini-pro',
    theme: 'light',
    autoSave: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createAPIVersionFactory(overrides: Partial<APIVersion> = {}): APIVersion {
  return {
    id: generateId(),
    service: 'gemini',
    currentVersion: '1.0.0',
    lastKnownGood: '1.0.0',
    availableVersions: ['1.0.0', '1.1.0'],
    lastChecked: new Date(),
    ...overrides,
  };
}

// Batch factories for creating multiple items
export function createSubmissions(count: number): Submission[] {
  return Array.from({ length: count }, () => createSubmissionFactory());
}

export function createGeneratedImages(count: number): GeneratedImage[] {
  return Array.from({ length: count }, () => createGeneratedImageFactory());
}

export function createUsers(count: number): User[] {
  return Array.from({ length: count }, () => createUserFactory());
}

// Reset counter (useful for test isolation)
export function resetIdCounter(): void {
  idCounter = 0;
}
