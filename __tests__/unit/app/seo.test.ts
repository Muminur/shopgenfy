import { describe, it, expect } from 'vitest';

describe('SEO Configuration', () => {
  describe('sitemap.ts', () => {
    it('should return valid sitemap with required URLs', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check each entry has required fields
      for (const entry of result) {
        expect(entry).toHaveProperty('url');
        expect(entry.url).toMatch(/^https?:\/\//);
      }
    });

    it('should include home page', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      // Home page URL ends with domain (no path) or with just a trailing slash
      const homeEntry = result.find((entry) => {
        const url = new URL(entry.url);
        return url.pathname === '/' || url.pathname === '';
      });
      expect(homeEntry).toBeDefined();
    });

    it('should include dashboard page', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      const dashboardEntry = result.find((entry) => entry.url.includes('/dashboard'));
      expect(dashboardEntry).toBeDefined();
    });

    it('should include settings page', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      const settingsEntry = result.find((entry) => entry.url.includes('/settings'));
      expect(settingsEntry).toBeDefined();
    });

    it('should have lastModified dates', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      for (const entry of result) {
        expect(entry).toHaveProperty('lastModified');
        expect(entry.lastModified).toBeInstanceOf(Date);
      }
    });

    it('should have changeFrequency for pages', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      for (const entry of result) {
        expect(entry).toHaveProperty('changeFrequency');
        expect(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).toContain(
          entry.changeFrequency
        );
      }
    });

    it('should have priority values between 0 and 1', async () => {
      const sitemap = await import('@/app/sitemap');
      const result = await sitemap.default();

      for (const entry of result) {
        expect(entry).toHaveProperty('priority');
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('robots.ts', () => {
    it('should return valid robots configuration', async () => {
      const robots = await import('@/app/robots');
      const result = await robots.default();

      expect(result).toHaveProperty('rules');
    });

    it('should allow all user agents', async () => {
      const robots = await import('@/app/robots');
      const result = await robots.default();

      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      const allowAllRule = rules.find((rule) => rule.userAgent === '*');
      expect(allowAllRule).toBeDefined();
    });

    it('should allow crawling of main pages', async () => {
      const robots = await import('@/app/robots');
      const result = await robots.default();

      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      const mainRule = rules.find((rule) => rule.userAgent === '*');

      expect(mainRule).toBeDefined();
      expect(mainRule?.allow).toBeDefined();
    });

    it('should disallow crawling of API routes', async () => {
      const robots = await import('@/app/robots');
      const result = await robots.default();

      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      const mainRule = rules.find((rule) => rule.userAgent === '*');

      expect(mainRule?.disallow).toBeDefined();
      const disallowList = Array.isArray(mainRule?.disallow)
        ? mainRule.disallow
        : [mainRule?.disallow];
      expect(disallowList.some((path) => path?.includes('/api/'))).toBe(true);
    });

    it('should include sitemap URL', async () => {
      const robots = await import('@/app/robots');
      const result = await robots.default();

      expect(result).toHaveProperty('sitemap');
      expect(result.sitemap).toMatch(/sitemap\.xml$/);
    });
  });
});
