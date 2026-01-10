import { describe, it, expect } from 'vitest';
import {
  generateIconPrompt,
  generateFeaturePrompt,
  generateBatchPrompts,
  sanitizePromptText,
  PromptInput,
} from '@/lib/prompt-generator';

describe('Prompt Generator', () => {
  describe('sanitizePromptText', () => {
    it('should remove Shopify branding from text', () => {
      const text = 'App with Shopify integration and Shopify logo';
      const result = sanitizePromptText(text);
      expect(result).not.toContain('Shopify');
    });

    it('should remove URLs from text', () => {
      const text = 'Check out https://example.com for more info';
      const result = sanitizePromptText(text);
      expect(result).not.toContain('https://');
      expect(result).not.toContain('example.com');
    });

    it('should trim and clean whitespace', () => {
      const text = '  Multiple   spaces   here  ';
      const result = sanitizePromptText(text);
      expect(result).toBe('Multiple spaces here');
    });

    it('should handle empty strings', () => {
      expect(sanitizePromptText('')).toBe('');
    });

    it('should truncate long text to 200 characters', () => {
      const longText = 'a'.repeat(300);
      const result = sanitizePromptText(longText);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe('generateIconPrompt', () => {
    it('should generate icon prompt with app name', () => {
      const input: PromptInput = {
        appName: 'ProductBoost',
        primaryCategory: 'Marketing',
        features: ['Email campaigns', 'Analytics'],
      };

      const result = generateIconPrompt(input);

      expect(result.prompt).toContain('ProductBoost');
      expect(result.prompt).toContain('1200x1200');
      expect(result.type).toBe('icon');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
    });

    it('should include category in prompt', () => {
      const input: PromptInput = {
        appName: 'InventoryPro',
        primaryCategory: 'Inventory management',
        features: ['Stock tracking'],
      };

      const result = generateIconPrompt(input);

      expect(result.prompt).toContain('Inventory management');
    });

    it('should include negative prompt excluding unwanted elements', () => {
      const input: PromptInput = {
        appName: 'TestApp',
        primaryCategory: 'Sales',
        features: [],
      };

      const result = generateIconPrompt(input);

      expect(result.negativePrompt).toContain('text');
      expect(result.negativePrompt).toContain('words');
      expect(result.negativePrompt).toContain('watermark');
    });

    it('should not contain Shopify branding in generated prompt', () => {
      const input: PromptInput = {
        appName: 'Shopify Helper',
        primaryCategory: 'Sales',
        features: [],
      };

      const result = generateIconPrompt(input);

      expect(result.prompt.toLowerCase()).not.toContain('shopify');
      expect(result.negativePrompt?.toLowerCase()).toContain('shopify');
    });

    it('should specify style requirements', () => {
      const input: PromptInput = {
        appName: 'CleanApp',
        primaryCategory: 'Productivity',
        features: [],
      };

      const result = generateIconPrompt(input);

      expect(result.prompt).toMatch(/modern|flat|minimal|clean/i);
      expect(result.prompt).toContain('high contrast');
    });
  });

  describe('generateFeaturePrompt', () => {
    it('should generate feature prompt with feature text', () => {
      const result = generateFeaturePrompt({
        appName: 'SalesBooster',
        feature: 'Real-time analytics dashboard',
        featureIndex: 0,
      });

      expect(result.prompt).toContain('Real-time analytics dashboard');
      expect(result.prompt).toContain('SalesBooster');
      expect(result.type).toBe('feature');
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
    });

    it('should use correct dimensions for feature images', () => {
      const result = generateFeaturePrompt({
        appName: 'TestApp',
        feature: 'Feature one',
        featureIndex: 0,
      });

      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
    });

    it('should include featureHighlighted field', () => {
      const result = generateFeaturePrompt({
        appName: 'TestApp',
        feature: 'Automated inventory sync',
        featureIndex: 2,
      });

      expect(result.featureHighlighted).toBe('Automated inventory sync');
    });

    it('should not contain Shopify branding', () => {
      const result = generateFeaturePrompt({
        appName: 'TestApp',
        feature: 'Shopify store integration',
        featureIndex: 0,
      });

      expect(result.prompt.toLowerCase()).not.toContain('shopify');
    });

    it('should truncate long feature text', () => {
      const longFeature =
        'This is a very long feature description that exceeds the normal limit '.repeat(5);

      const result = generateFeaturePrompt({
        appName: 'TestApp',
        feature: longFeature,
        featureIndex: 0,
      });

      expect(result.featureHighlighted).toBeDefined();
      expect(result.featureHighlighted!.length).toBeLessThanOrEqual(80);
    });
  });

  describe('generateBatchPrompts', () => {
    it('should generate 1 icon + N feature prompts (min 5 features)', () => {
      const input: PromptInput = {
        appName: 'MultiFeatureApp',
        primaryCategory: 'Marketing',
        features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5', 'Feature 6'],
      };

      const results = generateBatchPrompts(input);

      const iconPrompts = results.filter((p) => p.type === 'icon');
      const featurePrompts = results.filter((p) => p.type === 'feature');

      expect(iconPrompts).toHaveLength(1);
      expect(featurePrompts).toHaveLength(6);
    });

    it('should generate minimum 5 feature prompts even with fewer features', () => {
      const input: PromptInput = {
        appName: 'FewFeaturesApp',
        primaryCategory: 'Sales',
        features: ['Feature 1', 'Feature 2'],
      };

      const results = generateBatchPrompts(input);
      const featurePrompts = results.filter((p) => p.type === 'feature');

      expect(featurePrompts.length).toBeGreaterThanOrEqual(5);
    });

    it('should generate default prompts when no features provided', () => {
      const input: PromptInput = {
        appName: 'NoFeaturesApp',
        primaryCategory: 'Productivity',
        features: [],
      };

      const results = generateBatchPrompts(input);
      const featurePrompts = results.filter((p) => p.type === 'feature');

      expect(featurePrompts.length).toBeGreaterThanOrEqual(5);
    });

    it('should return prompts with all required fields', () => {
      const input: PromptInput = {
        appName: 'CompleteApp',
        primaryCategory: 'Analytics',
        features: ['Dashboard', 'Reports', 'Alerts', 'Exports', 'Settings'],
      };

      const results = generateBatchPrompts(input);

      for (const prompt of results) {
        expect(prompt.prompt).toBeDefined();
        expect(prompt.type).toMatch(/^(icon|feature)$/);
        expect(prompt.width).toBeGreaterThan(0);
        expect(prompt.height).toBeGreaterThan(0);
        expect(prompt.negativePrompt).toBeDefined();
      }
    });

    it('should include style for consistency across images', () => {
      const input: PromptInput = {
        appName: 'StyledApp',
        primaryCategory: 'Design',
        features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
      };

      const results = generateBatchPrompts(input);

      for (const prompt of results) {
        expect(prompt.style).toBeDefined();
      }
    });

    it('should limit maximum features to 10', () => {
      const input: PromptInput = {
        appName: 'ManyFeaturesApp',
        primaryCategory: 'Marketing',
        features: Array(15)
          .fill(null)
          .map((_, i) => `Feature ${i + 1}`),
      };

      const results = generateBatchPrompts(input);
      const featurePrompts = results.filter((p) => p.type === 'feature');

      expect(featurePrompts.length).toBeLessThanOrEqual(10);
    });
  });
});
