import { describe, it, expect } from 'vitest';
import {
  generateBatchPrompts,
  generateIconPrompt,
  generateFeaturePrompt,
  generatePromptWithStyleSeed,
  PromptInput,
} from '@/lib/prompt-generator';

describe('Prompt Generator - Consistent Style', () => {
  describe('generatePromptWithStyleSeed', () => {
    it('should generate prompts with a consistent style seed', () => {
      const input: PromptInput = {
        appName: 'StyleTestApp',
        primaryCategory: 'Design',
        features: ['Feature 1', 'Feature 2'],
      };

      const styleSeed = 'modern-blue-gradient-12345';
      const result = generatePromptWithStyleSeed(input, styleSeed);

      expect(result.prompt).toContain(styleSeed);
      expect(result.styleSeed).toBe(styleSeed);
    });

    it('should use generated style seed when none provided', () => {
      const input: PromptInput = {
        appName: 'AutoStyleApp',
        primaryCategory: 'Productivity',
        features: ['Dashboard'],
      };

      const result = generatePromptWithStyleSeed(input);

      expect(result.styleSeed).toBeDefined();
      expect(result.styleSeed).toMatch(/^[a-z0-9-]+$/);
    });

    it('should apply same style seed to all images in batch', () => {
      const input: PromptInput = {
        appName: 'ConsistentApp',
        primaryCategory: 'Marketing',
        features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
      };

      const results = generateBatchPrompts(input, { useConsistentStyle: true });

      const uniqueStyleSeeds = new Set(results.map((r) => r.styleSeed).filter(Boolean));
      expect(uniqueStyleSeeds.size).toBe(1);
    });

    it('should include style seed in icon prompt', () => {
      const input: PromptInput = {
        appName: 'IconApp',
        primaryCategory: 'Analytics',
        features: [],
      };

      const styleSeed = 'analytics-theme-67890';
      const result = generateIconPrompt(input, { styleSeed });

      expect(result.styleSeed).toBe(styleSeed);
      expect(result.prompt).toContain(styleSeed);
    });

    it('should include style seed in feature prompts', () => {
      const styleSeed = 'feature-style-54321';
      const result = generateFeaturePrompt(
        {
          appName: 'FeatureApp',
          feature: 'Analytics Dashboard',
          featureIndex: 0,
        },
        { styleSeed }
      );

      expect(result.styleSeed).toBe(styleSeed);
      expect(result.prompt).toContain(styleSeed);
    });

    it('should generate style seed based on app name and category', () => {
      const input: PromptInput = {
        appName: 'ProductivityPro',
        primaryCategory: 'Productivity',
        features: ['Task Manager'],
      };

      const result1 = generatePromptWithStyleSeed(input);
      const result2 = generatePromptWithStyleSeed(input);

      // Same input should generate same style seed (deterministic)
      expect(result1.styleSeed).toBe(result2.styleSeed);
    });

    it('should maintain style consistency across regenerations', () => {
      const input: PromptInput = {
        appName: 'RegenApp',
        primaryCategory: 'Sales',
        features: ['Dashboard', 'Reports'],
      };

      const batch1 = generateBatchPrompts(input, {
        useConsistentStyle: true,
        preserveStyleSeed: true,
      });
      const batch2 = generateBatchPrompts(input, {
        useConsistentStyle: true,
        preserveStyleSeed: true,
      });

      const styleSeed1 = batch1[0].styleSeed;
      const styleSeed2 = batch2[0].styleSeed;

      expect(styleSeed1).toBe(styleSeed2);
    });

    it('should allow different style seeds for different apps', () => {
      const input1: PromptInput = {
        appName: 'App1',
        primaryCategory: 'Marketing',
        features: ['Feature'],
      };

      const input2: PromptInput = {
        appName: 'App2',
        primaryCategory: 'Analytics',
        features: ['Feature'],
      };

      const result1 = generatePromptWithStyleSeed(input1);
      const result2 = generatePromptWithStyleSeed(input2);

      expect(result1.styleSeed).not.toBe(result2.styleSeed);
    });

    it('should include style parameters in generated prompt text', () => {
      const input: PromptInput = {
        appName: 'StyleApp',
        primaryCategory: 'Design',
        features: ['Creative Dashboard'],
      };

      const styleSeed = 'vibrant-modern-ui-theme';
      const result = generatePromptWithStyleSeed(input, styleSeed);

      expect(result.prompt).toContain('style seed');
      expect(result.prompt).toContain('consistent');
    });
  });

  describe('Batch generation with style consistency', () => {
    it('should mark all prompts with same style when consistency enabled', () => {
      const input: PromptInput = {
        appName: 'BatchStyleApp',
        primaryCategory: 'Productivity',
        features: ['Feature A', 'Feature B', 'Feature C', 'Feature D', 'Feature E'],
      };

      const results = generateBatchPrompts(input, { useConsistentStyle: true });

      const allHaveSameStyle = results.every((r) => r.styleSeed === results[0].styleSeed);
      expect(allHaveSameStyle).toBe(true);
    });

    it('should allow different styles when consistency disabled', () => {
      const input: PromptInput = {
        appName: 'VariedStyleApp',
        primaryCategory: 'Design',
        features: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'],
      };

      const results = generateBatchPrompts(input, { useConsistentStyle: false });

      // Each prompt could have different style
      expect(results[0].styleSeed).toBeDefined();
    });
  });
});
