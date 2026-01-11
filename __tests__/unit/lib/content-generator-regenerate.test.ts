import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Gemini client
const { mockAnalyzeUrl, mockGenerateContent } = vi.hoisted(() => ({
  mockAnalyzeUrl: vi.fn(),
  mockGenerateContent: vi.fn(),
}));

vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    analyzeUrl: mockAnalyzeUrl,
    generateContent: mockGenerateContent,
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

import { createContentGenerator } from '@/lib/content-generator';
import { GeminiError } from '@/lib/gemini';

describe('Content Generator - Regenerate Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('regenerateAnalysis', () => {
    it('should regenerate analysis by calling analyzeUrl again with same URL', async () => {
      const mockAnalysis = {
        appName: 'NewApp',
        appIntroduction: 'New tagline after regeneration',
        appDescription: 'New description with updated insights.',
        featureList: ['Updated Feature 1', 'Updated Feature 2', 'Updated Feature 3'],
        languages: ['en', 'es'],
        primaryCategory: 'Productivity',
        featureTags: ['updated', 'regenerated'],
        pricing: { type: 'freemium' as const },
        confidence: 0.92,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateAnalysis('https://example.com/app');

      expect(mockAnalyzeUrl).toHaveBeenCalledWith('https://example.com/app');
      expect(result.success).toBe(true);
      expect(result.content?.appName).toBe('NewApp');
      expect(result.content?.featureList).toHaveLength(3);
    });

    it('should return new data even if similar to previous analysis', async () => {
      const firstAnalysis = {
        appName: 'TestApp',
        appIntroduction: 'First analysis',
        appDescription: 'First description.',
        featureList: ['Feature A'],
        languages: ['en'],
        primaryCategory: 'Sales',
        featureTags: ['sales'],
        pricing: { type: 'free' as const },
        confidence: 0.8,
      };

      const secondAnalysis = {
        ...firstAnalysis,
        appIntroduction: 'Second analysis with slight variation',
        confidence: 0.85,
      };

      mockAnalyzeUrl.mockResolvedValueOnce(firstAnalysis).mockResolvedValueOnce(secondAnalysis);

      const generator = createContentGenerator('test-api-key');

      const firstResult = await generator.generateFromUrl('https://example.com/app');
      const regeneratedResult = await generator.regenerateAnalysis('https://example.com/app');

      expect(firstResult.content?.appIntroduction).toBe('First analysis');
      expect(regeneratedResult.content?.appIntroduction).toBe(
        'Second analysis with slight variation'
      );
    });

    it('should handle regeneration errors gracefully', async () => {
      mockAnalyzeUrl.mockRejectedValue(new GeminiError('API rate limit exceeded', 429));

      const generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateAnalysis('https://example.com/app');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });

    it('should apply the same sanitization and validation as initial analysis', async () => {
      const mockAnalysis = {
        appName: 'Shopify SuperApp',
        appIntroduction: 'The best #1 tool ever',
        appDescription: 'Contact us at support@example.com.',
        featureList: ['Shopify integration'],
        languages: ['en'],
        primaryCategory: 'Marketing',
        featureTags: ['shopify'],
        pricing: { type: 'paid' as const },
        confidence: 0.75,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateAnalysis('https://example.com/app');

      // Should sanitize Shopify branding
      expect(result.content?.appName.toLowerCase()).not.toContain('shopify');

      // Should detect validation issues
      expect(result.validation?.issues.length).toBeGreaterThan(0);
      expect(result.warnings).toBeDefined();
    });

    it('should return new confidence score with regenerated content', async () => {
      const mockAnalysis = {
        appName: 'RegeneratedApp',
        appIntroduction: 'Fresh analysis',
        appDescription: 'Better description after regeneration.',
        featureList: ['Feature 1', 'Feature 2'],
        languages: ['en'],
        primaryCategory: 'Analytics',
        featureTags: ['analytics'],
        pricing: { type: 'subscription' as const },
        confidence: 0.95,
      };

      mockAnalyzeUrl.mockResolvedValue(mockAnalysis);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateAnalysis('https://example.com/app');

      expect(result.confidence).toBe(0.95);
    });

    it('should handle network errors during regeneration', async () => {
      mockAnalyzeUrl.mockRejectedValue(new Error('Network connection failed'));

      const generator = createContentGenerator('test-api-key');
      const result = await generator.regenerateAnalysis('https://example.com/app');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate content');
    });
  });
});
