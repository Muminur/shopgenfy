import { describe, it, expect } from 'vitest';
import {
  API_CONFIG,
  GEMINI_CONFIG,
  NANO_BANANA_CONFIG,
  GOOGLE_DRIVE_CONFIG,
  MONGODB_CONFIG,
  APP_CONFIG,
} from '@/lib/config';

describe('API Configuration', () => {
  describe('API_CONFIG', () => {
    it('should have default timeout', () => {
      expect(API_CONFIG.defaultTimeout).toBeDefined();
      expect(API_CONFIG.defaultTimeout).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      expect(API_CONFIG.retry).toBeDefined();
      expect(API_CONFIG.retry.maxRetries).toBeGreaterThanOrEqual(0);
      expect(API_CONFIG.retry.baseDelay).toBeGreaterThan(0);
      expect(API_CONFIG.retry.maxDelay).toBeGreaterThan(API_CONFIG.retry.baseDelay);
    });
  });

  describe('GEMINI_CONFIG', () => {
    it('should have base URL', () => {
      expect(GEMINI_CONFIG.baseUrl).toBeDefined();
      expect(GEMINI_CONFIG.baseUrl).toMatch(/^https?:\/\//);
    });

    it('should have available models', () => {
      expect(GEMINI_CONFIG.models).toBeDefined();
      expect(GEMINI_CONFIG.models).toBeInstanceOf(Array);
      expect(GEMINI_CONFIG.models.length).toBeGreaterThan(0);
    });

    it('should have default model', () => {
      expect(GEMINI_CONFIG.defaultModel).toBeDefined();
      expect(GEMINI_CONFIG.models).toContain(GEMINI_CONFIG.defaultModel);
    });

    it('should have endpoint paths', () => {
      expect(GEMINI_CONFIG.endpoints).toBeDefined();
      expect(GEMINI_CONFIG.endpoints.models).toBeDefined();
      expect(GEMINI_CONFIG.endpoints.generateContent).toBeDefined();
    });
  });

  describe('NANO_BANANA_CONFIG', () => {
    it('should have base URL', () => {
      expect(NANO_BANANA_CONFIG.baseUrl).toBeDefined();
      expect(NANO_BANANA_CONFIG.baseUrl).toMatch(/^https?:\/\//);
    });

    it('should have supported dimensions', () => {
      expect(NANO_BANANA_CONFIG.supportedDimensions).toBeDefined();
      expect(NANO_BANANA_CONFIG.supportedDimensions.icon).toBeDefined();
      expect(NANO_BANANA_CONFIG.supportedDimensions.feature).toBeDefined();
    });

    it('should have correct icon dimensions', () => {
      expect(NANO_BANANA_CONFIG.supportedDimensions.icon.width).toBe(1200);
      expect(NANO_BANANA_CONFIG.supportedDimensions.icon.height).toBe(1200);
    });

    it('should have correct feature dimensions', () => {
      expect(NANO_BANANA_CONFIG.supportedDimensions.feature.width).toBe(1600);
      expect(NANO_BANANA_CONFIG.supportedDimensions.feature.height).toBe(900);
    });

    it('should have endpoint paths', () => {
      expect(NANO_BANANA_CONFIG.endpoints).toBeDefined();
      expect(NANO_BANANA_CONFIG.endpoints.generate).toBeDefined();
      expect(NANO_BANANA_CONFIG.endpoints.status).toBeDefined();
    });
  });

  describe('GOOGLE_DRIVE_CONFIG', () => {
    it('should have base URL', () => {
      expect(GOOGLE_DRIVE_CONFIG.baseUrl).toBeDefined();
    });

    it('should have upload URL', () => {
      expect(GOOGLE_DRIVE_CONFIG.uploadUrl).toBeDefined();
    });

    it('should have auth URL', () => {
      expect(GOOGLE_DRIVE_CONFIG.authUrl).toBeDefined();
    });

    it('should have scopes', () => {
      expect(GOOGLE_DRIVE_CONFIG.scopes).toBeDefined();
      expect(GOOGLE_DRIVE_CONFIG.scopes).toBeInstanceOf(Array);
    });
  });

  describe('MONGODB_CONFIG', () => {
    it('should have pool configuration', () => {
      expect(MONGODB_CONFIG.pool).toBeDefined();
      expect(MONGODB_CONFIG.pool.maxPoolSize).toBeGreaterThan(0);
      expect(MONGODB_CONFIG.pool.minPoolSize).toBeGreaterThanOrEqual(0);
    });

    it('should have timeout configuration', () => {
      expect(MONGODB_CONFIG.timeouts).toBeDefined();
      expect(MONGODB_CONFIG.timeouts.connectTimeoutMS).toBeGreaterThan(0);
      expect(MONGODB_CONFIG.timeouts.socketTimeoutMS).toBeGreaterThan(0);
    });

    it('should have collection names', () => {
      expect(MONGODB_CONFIG.collections).toBeDefined();
      expect(MONGODB_CONFIG.collections.submissions).toBe('submissions');
      expect(MONGODB_CONFIG.collections.users).toBe('users');
      expect(MONGODB_CONFIG.collections.images).toBe('generated_images');
    });
  });

  describe('APP_CONFIG', () => {
    it('should have version', () => {
      expect(APP_CONFIG.version).toBeDefined();
    });

    it('should have name', () => {
      expect(APP_CONFIG.name).toBe('Shopgenfy');
    });

    it('should have Shopify compliance limits', () => {
      expect(APP_CONFIG.shopifyLimits).toBeDefined();
      expect(APP_CONFIG.shopifyLimits.appName).toBe(30);
      expect(APP_CONFIG.shopifyLimits.appIntroduction).toBe(100);
      expect(APP_CONFIG.shopifyLimits.appDescription).toBe(500);
      expect(APP_CONFIG.shopifyLimits.featureItem).toBe(80);
      expect(APP_CONFIG.shopifyLimits.worksWith).toBe(6);
      expect(APP_CONFIG.shopifyLimits.featureTags).toBe(25);
    });
  });
});
