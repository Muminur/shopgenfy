import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Gemini client
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@/lib/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
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

describe('Content Generator - Alt Text Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAltText', () => {
    it('should generate descriptive alt text for app icon', async () => {
      const mockAltText = {
        text: 'Modern minimalist app icon featuring a blue gradient with abstract geometric shapes representing productivity and efficiency',
        finishReason: 'STOP',
        usage: { promptTokens: 20, outputTokens: 25, totalTokens: 45 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'icon',
        appName: 'ProductivityPro',
        featureHighlighted: undefined,
        generationPrompt: 'Modern app icon with blue gradient and geometric shapes',
      });

      expect(result.success).toBe(true);
      expect(result.altText).toBeDefined();
      expect(result.altText?.length).toBeGreaterThan(20);
    });

    it('should generate alt text for feature image with context', async () => {
      const mockAltText = {
        text: 'Screenshot of analytics dashboard showing real-time sales data with interactive charts, graphs, and key performance indicators',
        finishReason: 'STOP',
        usage: { promptTokens: 25, outputTokens: 30, totalTokens: 55 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'SalesBooster',
        featureHighlighted: 'Real-time analytics dashboard',
        generationPrompt: 'Dashboard showing sales charts and metrics',
      });

      expect(result.success).toBe(true);
      expect(result.altText).toContain('dashboard');
      expect(result.altText).toContain('analytics');
    });

    it('should limit alt text to reasonable length (max 200 characters)', async () => {
      const longAltText = {
        text: 'A'.repeat(300),
        finishReason: 'STOP',
        usage: { promptTokens: 20, outputTokens: 100, totalTokens: 120 },
      };

      mockGenerateContent.mockResolvedValue(longAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'TestApp',
        featureHighlighted: 'Test feature',
        generationPrompt: 'Test prompt',
      });

      expect(result.altText?.length).toBeLessThanOrEqual(200);
    });

    it('should avoid Shopify branding in alt text', async () => {
      const mockAltText = {
        text: 'Shopify store dashboard showing Shopify product listings and Shopify analytics',
        finishReason: 'STOP',
        usage: { promptTokens: 20, outputTokens: 20, totalTokens: 40 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'StoreManager',
        featureHighlighted: 'Store dashboard',
        generationPrompt: 'Dashboard for store management',
      });

      expect(result.altText?.toLowerCase()).not.toContain('shopify');
    });

    it('should handle generation errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new GeminiError('API quota exceeded', 429));

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'icon',
        appName: 'TestApp',
        generationPrompt: 'App icon',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API quota exceeded');
    });

    it('should provide fallback alt text when API fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network error'));

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'FallbackApp',
        featureHighlighted: 'User Management',
        generationPrompt: 'User management interface',
      });

      expect(result.success).toBe(false);
      expect(result.fallbackAltText).toBeDefined();
      expect(result.fallbackAltText).toContain('FallbackApp');
      expect(result.fallbackAltText).toContain('User Management');
    });

    it('should create descriptive alt text for icon without feature context', async () => {
      const mockAltText = {
        text: 'Circular app icon with vibrant colors and abstract design representing creativity',
        finishReason: 'STOP',
        usage: { promptTokens: 15, outputTokens: 20, totalTokens: 35 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'icon',
        appName: 'CreativeStudio',
        generationPrompt: 'Circular icon with vibrant abstract design',
      });

      expect(result.success).toBe(true);
      expect(result.altText).not.toContain('undefined');
      expect(result.altText).toContain('icon');
    });

    it('should generate batch alt texts for multiple images', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          text: 'App icon with modern design',
          finishReason: 'STOP',
          usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 },
        })
        .mockResolvedValueOnce({
          text: 'Dashboard showing analytics',
          finishReason: 'STOP',
          usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 },
        })
        .mockResolvedValueOnce({
          text: 'User management interface',
          finishReason: 'STOP',
          usage: { promptTokens: 10, outputTokens: 10, totalTokens: 20 },
        });

      const generator = createContentGenerator('test-api-key');

      const images = [
        {
          imageType: 'icon' as const,
          appName: 'BatchApp',
          generationPrompt: 'App icon',
        },
        {
          imageType: 'feature' as const,
          appName: 'BatchApp',
          featureHighlighted: 'Analytics',
          generationPrompt: 'Analytics dashboard',
        },
        {
          imageType: 'feature' as const,
          appName: 'BatchApp',
          featureHighlighted: 'User Management',
          generationPrompt: 'User management screen',
        },
      ];

      const results = await Promise.all(images.map((img) => generator.generateAltText(img)));

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results[0].altText).toContain('icon');
      expect(results[1].altText).toContain('analytics');
      expect(results[2].altText).toContain('management');
    });

    it('should include accessibility best practices in alt text', async () => {
      const mockAltText = {
        text: 'Interactive dashboard displaying sales metrics with bar charts and line graphs for data visualization',
        finishReason: 'STOP',
        usage: { promptTokens: 20, outputTokens: 25, totalTokens: 45 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'AccessibleApp',
        featureHighlighted: 'Sales dashboard',
        generationPrompt: 'Dashboard with charts and graphs',
      });

      // Alt text should be descriptive, not just labels
      expect(result.altText).toBeDefined();
      expect(result.altText!.split(' ').length).toBeGreaterThan(5);
    });

    it('should not include decorative words like "image of" or "picture of"', async () => {
      const mockAltText = {
        text: 'Image of a dashboard showing charts',
        finishReason: 'STOP',
        usage: { promptTokens: 15, outputTokens: 12, totalTokens: 27 },
      };

      mockGenerateContent.mockResolvedValue(mockAltText);

      const generator = createContentGenerator('test-api-key');
      const result = await generator.generateAltText({
        imageType: 'feature',
        appName: 'CleanApp',
        featureHighlighted: 'Dashboard',
        generationPrompt: 'Dashboard visualization',
      });

      // Should clean up redundant prefixes
      expect(result.altText?.toLowerCase()).not.toMatch(/^image of/);
      expect(result.altText?.toLowerCase()).not.toMatch(/^picture of/);
    });
  });
});
