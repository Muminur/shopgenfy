import { describe, it, expect } from 'vitest';
import {
  createSubmissionFactory,
  createGeneratedImageFactory,
  createUserFactory,
  createPricingConfigFactory,
  createAPIVersionFactory,
} from './index';

describe('Test Factories', () => {
  describe('createSubmissionFactory', () => {
    it('should create a valid submission with defaults', () => {
      const submission = createSubmissionFactory();

      expect(submission.id).toBeDefined();
      expect(submission.userId).toBeDefined();
      expect(submission.appName).toBeDefined();
      expect(submission.appName.length).toBeLessThanOrEqual(30);
      expect(submission.appIntroduction.length).toBeLessThanOrEqual(100);
      expect(submission.appDescription.length).toBeLessThanOrEqual(500);
      expect(submission.featureList).toBeInstanceOf(Array);
      expect(submission.status).toBe('draft');
      expect(submission.createdAt).toBeInstanceOf(Date);
      expect(submission.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding specific fields', () => {
      const submission = createSubmissionFactory({
        appName: 'My Custom App',
        status: 'complete',
      });

      expect(submission.appName).toBe('My Custom App');
      expect(submission.status).toBe('complete');
    });

    it('should generate unique IDs for each submission', () => {
      const sub1 = createSubmissionFactory();
      const sub2 = createSubmissionFactory();

      expect(sub1.id).not.toBe(sub2.id);
    });

    it('should respect Shopify character limits', () => {
      const submission = createSubmissionFactory();

      expect(submission.appName.length).toBeLessThanOrEqual(30);
      expect(submission.appIntroduction.length).toBeLessThanOrEqual(100);
      expect(submission.appDescription.length).toBeLessThanOrEqual(500);
      submission.featureList.forEach((feature) => {
        expect(feature.length).toBeLessThanOrEqual(80);
      });
    });

    it('should have valid worksWith limit', () => {
      const submission = createSubmissionFactory();
      expect(submission.worksWith.length).toBeLessThanOrEqual(6);
    });

    it('should have valid featureTags limit', () => {
      const submission = createSubmissionFactory();
      expect(submission.featureTags.length).toBeLessThanOrEqual(25);
    });
  });

  describe('createGeneratedImageFactory', () => {
    it('should create a valid generated image with defaults', () => {
      const image = createGeneratedImageFactory();

      expect(image.id).toBeDefined();
      expect(image.submissionId).toBeDefined();
      expect(['icon', 'feature']).toContain(image.type);
      expect(image.driveFileId).toBeDefined();
      expect(image.driveUrl).toMatch(/^https?:\/\//);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(['png', 'jpeg']).toContain(image.format);
      expect(image.version).toBeGreaterThanOrEqual(1);
      expect(image.createdAt).toBeInstanceOf(Date);
    });

    it('should allow overriding specific fields', () => {
      const image = createGeneratedImageFactory({
        type: 'icon',
        width: 1200,
        height: 1200,
      });

      expect(image.type).toBe('icon');
      expect(image.width).toBe(1200);
      expect(image.height).toBe(1200);
    });

    it('should create icon with correct dimensions', () => {
      const icon = createGeneratedImageFactory({ type: 'icon' });
      // Icon should be 1200x1200
      expect(icon.width).toBe(1200);
      expect(icon.height).toBe(1200);
    });

    it('should create feature image with correct dimensions', () => {
      const feature = createGeneratedImageFactory({ type: 'feature' });
      // Feature should be 1600x900
      expect(feature.width).toBe(1600);
      expect(feature.height).toBe(900);
    });
  });

  describe('createUserFactory', () => {
    it('should create a valid user with defaults', () => {
      const user = createUserFactory();

      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/@/);
      expect(user.selectedGeminiModel).toBeDefined();
      expect(['light', 'dark', 'system']).toContain(user.theme);
      expect(typeof user.autoSave).toBe('boolean');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding specific fields', () => {
      const user = createUserFactory({
        email: 'test@example.com',
        theme: 'dark',
      });

      expect(user.email).toBe('test@example.com');
      expect(user.theme).toBe('dark');
    });

    it('should generate unique IDs for each user', () => {
      const user1 = createUserFactory();
      const user2 = createUserFactory();

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('createPricingConfigFactory', () => {
    it('should create a valid pricing config with defaults', () => {
      const pricing = createPricingConfigFactory();

      expect(['free', 'freemium', 'paid', 'subscription']).toContain(pricing.type);
    });

    it('should allow overriding pricing type', () => {
      const pricing = createPricingConfigFactory({ type: 'paid', price: 9.99 });

      expect(pricing.type).toBe('paid');
      expect(pricing.price).toBe(9.99);
    });

    it('should include billing cycle for subscription', () => {
      const pricing = createPricingConfigFactory({
        type: 'subscription',
        billingCycle: 'monthly',
      });

      expect(pricing.type).toBe('subscription');
      expect(pricing.billingCycle).toBe('monthly');
    });
  });

  describe('createAPIVersionFactory', () => {
    it('should create a valid API version with defaults', () => {
      const apiVersion = createAPIVersionFactory();

      expect(apiVersion.id).toBeDefined();
      expect(['gemini', 'nanobanana']).toContain(apiVersion.service);
      expect(apiVersion.currentVersion).toBeDefined();
      expect(apiVersion.lastKnownGood).toBeDefined();
      expect(apiVersion.availableVersions).toBeInstanceOf(Array);
      expect(apiVersion.lastChecked).toBeInstanceOf(Date);
    });

    it('should allow overriding specific fields', () => {
      const apiVersion = createAPIVersionFactory({
        service: 'gemini',
        currentVersion: '1.5-pro',
      });

      expect(apiVersion.service).toBe('gemini');
      expect(apiVersion.currentVersion).toBe('1.5-pro');
    });
  });
});
