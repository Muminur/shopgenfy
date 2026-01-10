import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock functions are available when vi.mock factory runs
const { mockAnalyzeUrl, mockGenerateContent, mockListModels, mockGenerateContentStream } =
  vi.hoisted(() => ({
    mockAnalyzeUrl: vi.fn(),
    mockGenerateContent: vi.fn(),
    mockListModels: vi.fn(),
    mockGenerateContentStream: vi.fn(),
  }));

// Mock the entire gemini module
vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    analyzeUrl: mockAnalyzeUrl,
    generateContent: mockGenerateContent,
    listModels: mockListModels,
    generateContentStream: mockGenerateContentStream,
  })),
  GeminiError: class GeminiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'GeminiError';
      this.statusCode = statusCode;
    }
  },
}));

// Import after mock is set up
import { ContentGenerator, createContentGenerator } from '@/lib/content-generator';
import { GeminiError } from '@/lib/gemini';

describe('Content Generator', () => {
  let generator: ContentGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyzeUrl.mockReset();
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createContentGenerator', () => {
    it('should create a content generator instance', () => {
      generator = createContentGenerator('test-api-key');
      expect(generator).toBeDefined();
      expect(generator.generateFromUrl).toBeInstanceOf(Function);
      expect(generator.regenerateField).toBeInstanceOf(Function);
    });

    it('should throw error when API key is missing', () => {
      expect(() => createContentGenerator('')).toThrow('API key is required');
    });
  });

  describe('generateFromUrl', () => {
    it('should generate content from a valid URL', async () => {
      const mockAnalysis = {
        appName: 'TestApp',
        appIntroduction: 'A great test application',
        appDescription: 'This is a comprehensive test application for productivity.',
        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['productivity', 'automation'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.success).toBe(true);
      expect(result.content?.appName).toBe('TestApp');
      expect(result.content?.appIntroduction).toBe('A great test application');
      expect(result.content?.featureList).toHaveLength(3);
    });

    it('should sanitize Shopify branding from generated content', async () => {
      const mockAnalysis = {
        appName: 'Shopify Helper',
        appIntroduction: 'Best Shopify integration tool',
        appDescription: 'Integrate with Shopify stores easily.',
        featureList: ['Shopify sync', 'Store analytics'],
        languages: ['en'],
        primaryCategory: 'Sales',
        featureTags: ['shopify', 'integration'],
        pricing: { type: 'free' as const },
        confidence: 0.8,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.content?.appName.toLowerCase()).not.toContain('shopify');
      expect(result.content?.appIntroduction.toLowerCase()).not.toContain('shopify');
      expect(result.content?.appDescription.toLowerCase()).not.toContain('shopify');
    });

    it('should enforce character limits on all fields', async () => {
      const longText = 'a'.repeat(600);
      const mockAnalysis = {
        appName: longText,
        appIntroduction: longText,
        appDescription: longText,
        featureList: [longText],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['tag1'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.content?.appName.length).toBeLessThanOrEqual(30);
      expect(result.content?.appIntroduction.length).toBeLessThanOrEqual(100);
      expect(result.content?.appDescription.length).toBeLessThanOrEqual(500);
      expect(result.content?.featureList[0].length).toBeLessThanOrEqual(80);
    });

    it('should handle invalid URLs', async () => {
      mockAnalyzeUrl.mockRejectedValue(new GeminiError('Invalid URL format'));

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should handle API errors gracefully', async () => {
      mockAnalyzeUrl.mockRejectedValue(new GeminiError('Rate limit exceeded', 429));

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should include validation warnings for potentially problematic content', async () => {
      const mockAnalysis = {
        appName: 'The Best App Ever',
        appIntroduction: '#1 rated productivity tool',
        appDescription: 'Contact us at support@example.com for help.',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['best', 'top'],
        pricing: { type: 'free' as const },
        confidence: 0.7,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it('should provide confidence score in the result', async () => {
      const mockAnalysis = {
        appName: 'TestApp',
        appIntroduction: 'Test app',
        appDescription: 'A test app',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['test'],
        pricing: { type: 'free' as const },
        confidence: 0.85,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.confidence).toBe(0.85);
    });
  });

  describe('regenerateField', () => {
    it('should regenerate a specific field', async () => {
      const mockResult = {
        text: 'A better app name',
        finishReason: 'STOP',
        usage: { promptTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockGenerateContent.mockResolvedValue(mockResult);

      generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateField({
        field: 'appName',
        context: {
          appName: 'OldName',
          appDescription: 'Test app description',
          primaryCategory: 'Productivity',
        },
        instructions: 'Make it more catchy',
      });

      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
    });

    it('should enforce character limit when regenerating', async () => {
      const longName = 'a'.repeat(50);
      const mockResult = {
        text: longName,
        finishReason: 'STOP',
        usage: { promptTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockGenerateContent.mockResolvedValue(mockResult);

      generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateField({
        field: 'appName',
        context: { appName: 'OldName', primaryCategory: 'Productivity' },
      });

      expect(result.value?.length).toBeLessThanOrEqual(30);
    });

    it('should sanitize regenerated content', async () => {
      const mockResult = {
        text: 'Shopify Integration Tool',
        finishReason: 'STOP',
        usage: { promptTokens: 10, outputTokens: 5, totalTokens: 15 },
      };

      mockGenerateContent.mockResolvedValue(mockResult);

      generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateField({
        field: 'appName',
        context: { appName: 'OldName', primaryCategory: 'Sales' },
      });

      expect((result.value as string)?.toLowerCase()).not.toContain('shopify');
    });

    it('should regenerate feature list items', async () => {
      const mockResult = {
        text: JSON.stringify(['New Feature 1', 'New Feature 2', 'New Feature 3']),
        finishReason: 'STOP',
        usage: { promptTokens: 10, outputTokens: 20, totalTokens: 30 },
      };

      mockGenerateContent.mockResolvedValue(mockResult);

      generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateField({
        field: 'featureList',
        context: {
          appName: 'TestApp',
          featureList: ['Old Feature'],
          primaryCategory: 'Productivity',
        },
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
    });

    it('should handle regeneration errors', async () => {
      mockGenerateContent.mockRejectedValue(new GeminiError('Generation failed'));

      generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateField({
        field: 'appName',
        context: { appName: 'TestApp', primaryCategory: 'Productivity' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateContent', () => {
    it('should validate content against Shopify guidelines', async () => {
      const mockAnalysis = {
        appName: 'TestApp',
        appIntroduction: 'A test application',
        appDescription: 'Description',
        featureList: ['Feature'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['test'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.validation).toBeDefined();
      expect(result.validation?.isValid).toBe(true);
    });

    it('should detect superlative claims', async () => {
      const mockAnalysis = {
        appName: 'BestApp',
        appIntroduction: 'The #1 best tool in the world',
        appDescription: 'We are the leading provider',
        featureList: ['Best in class feature'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['best'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.validation?.issues?.length).toBeGreaterThan(0);
      expect(result.validation?.issues?.some((i) => i.type === 'superlative')).toBe(true);
    });

    it('should detect contact information in descriptions', async () => {
      const mockAnalysis = {
        appName: 'TestApp',
        appIntroduction: 'Contact us at 555-1234',
        appDescription: 'Email us at test@example.com for support',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['test'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.validation?.issues?.some((i) => i.type === 'contact_info')).toBe(true);
    });
  });

  describe('suggestImprovements', () => {
    it('should suggest improvements for low quality content', async () => {
      const mockAnalysis = {
        appName: 'App',
        appIntroduction: 'App',
        appDescription: 'App',
        featureList: ['Feature'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' as const },
        confidence: 0.3,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should not suggest improvements for high quality content', async () => {
      const mockAnalysis = {
        appName: 'ProductivityPro',
        appIntroduction: 'Boost your team productivity with smart automation',
        appDescription:
          'ProductivityPro helps teams automate repetitive tasks and focus on what matters. Features include task scheduling, workflow automation, and team collaboration tools.',
        featureList: [
          'Automated task scheduling',
          'Team collaboration dashboard',
          'Workflow templates',
          'Analytics and reporting',
          'Third-party integrations',
        ],
        languages: ['en', 'es', 'fr'],
        primaryCategory: 'Productivity',
        featureTags: ['automation', 'productivity', 'collaboration', 'workflow'],
        pricing: { type: 'freemium' as const },
        confidence: 0.95,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      generator = createContentGenerator('test-api-key');
      const result = await generator.generateFromUrl('https://example.com/app');

      expect(result.suggestions?.length).toBe(0);
    });
  });
});
