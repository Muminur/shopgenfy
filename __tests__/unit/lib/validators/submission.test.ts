import { describe, it, expect } from 'vitest';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  validateSubmission,
} from '@/lib/validators/submission';
import { SHOPIFY_LIMITS } from '@/lib/validators/constants';

describe('Submission Validation Schema', () => {
  const validSubmission = {
    appName: 'MyBrand Store Helper',
    appIntroduction: 'A simple tagline for the app',
    appDescription: 'This is a description of the app that helps merchants.',
    featureList: ['Feature one', 'Feature two'],
    languages: ['en'],
    worksWith: ['Shopify POS'],
    primaryCategory: 'Store design',
    featureTags: ['productivity', 'design'],
    pricing: {
      type: 'free' as const,
    },
    landingPageUrl: 'https://example.com',
  };

  describe('appName validation', () => {
    it('should accept valid app name within limit', () => {
      const result = createSubmissionSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);
    });

    it('should reject app name exceeding 30 characters', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appName: 'A'.repeat(SHOPIFY_LIMITS.APP_NAME_MAX + 1),
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty app name', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('appIntroduction validation', () => {
    it('should accept valid introduction within limit', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appIntroduction: 'A'.repeat(SHOPIFY_LIMITS.APP_INTRODUCTION_MAX),
      });
      expect(result.success).toBe(true);
    });

    it('should reject introduction exceeding 100 characters', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appIntroduction: 'A'.repeat(SHOPIFY_LIMITS.APP_INTRODUCTION_MAX + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('appDescription validation', () => {
    it('should accept valid description within limit', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appDescription: 'A'.repeat(SHOPIFY_LIMITS.APP_DESCRIPTION_MAX),
      });
      expect(result.success).toBe(true);
    });

    it('should reject description exceeding 500 characters', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appDescription: 'A'.repeat(SHOPIFY_LIMITS.APP_DESCRIPTION_MAX + 1),
      });
      expect(result.success).toBe(false);
    });

    it('should reject description with contact info', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appDescription: 'Contact us at email@example.com for support',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description with unverifiable claims', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        appDescription: 'The best app for your store',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('featureList validation', () => {
    it('should accept valid feature list', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject feature item exceeding 80 characters', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        featureList: ['A'.repeat(SHOPIFY_LIMITS.FEATURE_ITEM_MAX + 1)],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('worksWith validation', () => {
    it('should accept up to 6 items', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        worksWith: ['1', '2', '3', '4', '5', '6'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject more than 6 items', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        worksWith: ['1', '2', '3', '4', '5', '6', '7'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('featureTags validation', () => {
    it('should accept up to 25 tags', () => {
      const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        featureTags: tags,
      });
      expect(result.success).toBe(true);
    });

    it('should reject more than 25 tags', () => {
      const tags = Array.from({ length: 26 }, (_, i) => `tag${i}`);
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        featureTags: tags,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('landingPageUrl validation', () => {
    it('should accept valid HTTPS URL', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        landingPageUrl: 'https://myapp.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTP URL', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        landingPageUrl: 'http://myapp.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        landingPageUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pricing validation', () => {
    it('should accept free pricing', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        pricing: { type: 'free' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept paid pricing with required fields', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        pricing: {
          type: 'paid',
          price: 9.99,
          currency: 'USD',
          billingCycle: 'monthly',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept subscription pricing with trial', () => {
      const result = createSubmissionSchema.safeParse({
        ...validSubmission,
        pricing: {
          type: 'subscription',
          price: 19.99,
          currency: 'USD',
          billingCycle: 'monthly',
          trialDays: 14,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validateSubmission helper', () => {
    it('should return success for valid data', () => {
      const result = validateSubmission(validSubmission);
      expect(result.success).toBe(true);
    });

    it('should return errors for invalid data', () => {
      const result = validateSubmission({
        ...validSubmission,
        appName: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('updateSubmissionSchema', () => {
    it('should allow partial updates', () => {
      const result = updateSubmissionSchema.safeParse({
        appName: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should validate provided fields', () => {
      const result = updateSubmissionSchema.safeParse({
        appName: 'A'.repeat(SHOPIFY_LIMITS.APP_NAME_MAX + 1),
      });
      expect(result.success).toBe(false);
    });
  });
});
