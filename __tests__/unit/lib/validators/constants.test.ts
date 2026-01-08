import { describe, it, expect } from 'vitest';
import {
  SHOPIFY_LIMITS,
  IMAGE_SPECS,
  FORBIDDEN_PATTERNS,
  SHOPIFY_CATEGORIES,
  SUPPORTED_LANGUAGES,
} from '@/lib/validators/constants';

describe('Shopify Validation Constants', () => {
  describe('SHOPIFY_LIMITS', () => {
    it('should define app name max length as 30', () => {
      expect(SHOPIFY_LIMITS.APP_NAME_MAX).toBe(30);
    });

    it('should define app introduction max length as 100', () => {
      expect(SHOPIFY_LIMITS.APP_INTRODUCTION_MAX).toBe(100);
    });

    it('should define app description max length as 500', () => {
      expect(SHOPIFY_LIMITS.APP_DESCRIPTION_MAX).toBe(500);
    });

    it('should define feature item max length as 80', () => {
      expect(SHOPIFY_LIMITS.FEATURE_ITEM_MAX).toBe(80);
    });

    it('should define works with max items as 6', () => {
      expect(SHOPIFY_LIMITS.WORKS_WITH_MAX_ITEMS).toBe(6);
    });

    it('should define feature tags max items as 25', () => {
      expect(SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS).toBe(25);
    });
  });

  describe('IMAGE_SPECS', () => {
    it('should define icon dimensions as 1200x1200', () => {
      expect(IMAGE_SPECS.ICON.width).toBe(1200);
      expect(IMAGE_SPECS.ICON.height).toBe(1200);
    });

    it('should define feature image dimensions as 1600x900', () => {
      expect(IMAGE_SPECS.FEATURE.width).toBe(1600);
      expect(IMAGE_SPECS.FEATURE.height).toBe(900);
    });

    it('should define max file size as 20MB', () => {
      expect(IMAGE_SPECS.MAX_FILE_SIZE_MB).toBe(20);
    });

    it('should define safe zone as 100px', () => {
      expect(IMAGE_SPECS.SAFE_ZONE_PX).toBe(100);
    });

    it('should define minimum contrast ratio as 4.5', () => {
      expect(IMAGE_SPECS.MIN_CONTRAST_RATIO).toBe(4.5);
    });
  });

  describe('FORBIDDEN_PATTERNS', () => {
    it('should match contact information patterns', () => {
      expect(FORBIDDEN_PATTERNS.CONTACT_INFO.test('email us')).toBe(true);
      expect(FORBIDDEN_PATTERNS.CONTACT_INFO.test('contact@example.com')).toBe(true);
      expect(FORBIDDEN_PATTERNS.CONTACT_INFO.test('call now')).toBe(true);
      expect(FORBIDDEN_PATTERNS.CONTACT_INFO.test('great app')).toBe(false);
    });

    it('should match unverifiable claims patterns', () => {
      expect(FORBIDDEN_PATTERNS.UNVERIFIABLE_CLAIMS.test('best app ever')).toBe(true);
      expect(FORBIDDEN_PATTERNS.UNVERIFIABLE_CLAIMS.test('#1 solution')).toBe(true);
      expect(FORBIDDEN_PATTERNS.UNVERIFIABLE_CLAIMS.test('top rated')).toBe(true);
      expect(FORBIDDEN_PATTERNS.UNVERIFIABLE_CLAIMS.test('great features')).toBe(false);
    });

    it('should match Shopify branding patterns', () => {
      expect(FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test('Shopify app')).toBe(true);
      expect(FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test('for shopify')).toBe(true);
      expect(FORBIDDEN_PATTERNS.SHOPIFY_BRANDING.test('ecommerce app')).toBe(false);
    });
  });

  describe('SHOPIFY_CATEGORIES', () => {
    it('should include common categories', () => {
      expect(SHOPIFY_CATEGORIES).toContain('Store design');
      expect(SHOPIFY_CATEGORIES).toContain('Marketing');
      expect(SHOPIFY_CATEGORIES).toContain('Sales and conversion');
      expect(SHOPIFY_CATEGORIES).toContain('Orders and shipping');
    });

    it('should have at least 10 categories', () => {
      expect(SHOPIFY_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include English', () => {
      expect(SUPPORTED_LANGUAGES).toContainEqual(
        expect.objectContaining({ code: 'en', name: 'English' })
      );
    });

    it('should have language code and name for each entry', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(typeof lang.code).toBe('string');
        expect(typeof lang.name).toBe('string');
      });
    });
  });
});
