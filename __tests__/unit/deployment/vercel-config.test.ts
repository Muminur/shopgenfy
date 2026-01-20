import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Vercel Configuration', () => {
  const configPath = join(process.cwd(), 'vercel.json');

  describe('File existence and validity', () => {
    it('should have vercel.json file in project root', () => {
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have valid JSON structure', () => {
      const content = readFileSync(configPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have $schema property for validation', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.$schema).toBeDefined();
      expect(config.$schema).toContain('vercel.json');
    });
  });

  describe('Functions configuration', () => {
    it('should have functions configuration', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.functions).toBeDefined();
    });

    it('should configure maxDuration to 60 seconds for API routes', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.functions).toBeDefined();

      // Check if there's a pattern that matches API routes
      const apiPattern = Object.keys(config.functions).find(
        (key) => key.includes('api') && key.includes('*.ts')
      );

      expect(apiPattern).toBeDefined();
      expect(config.functions[apiPattern!].maxDuration).toBe(60);
    });

    it('should have maxDuration within Vercel limits (max 60s for hobby, 300s for pro)', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      Object.values(config.functions || {}).forEach((funcConfig: unknown) => {
        const fc = funcConfig as { maxDuration?: number };
        if (fc.maxDuration) {
          expect(fc.maxDuration).toBeGreaterThan(0);
          expect(fc.maxDuration).toBeLessThanOrEqual(300);
        }
      });
    });
  });

  describe('Security headers configuration', () => {
    it('should have headers configuration', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.headers).toBeDefined();
      expect(Array.isArray(config.headers)).toBe(true);
    });

    it('should configure security headers for all paths', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      expect(securityHeaders).toBeDefined();
      expect(securityHeaders.headers).toBeDefined();
      expect(Array.isArray(securityHeaders.headers)).toBe(true);
    });

    it('should include X-Content-Type-Options header', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      const xContentTypeOptions = securityHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'X-Content-Type-Options'
      );

      expect(xContentTypeOptions).toBeDefined();
      expect(xContentTypeOptions.value).toBe('nosniff');
    });

    it('should include X-Frame-Options header', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      const xFrameOptions = securityHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'X-Frame-Options'
      );

      expect(xFrameOptions).toBeDefined();
      expect(xFrameOptions.value).toBe('DENY');
    });

    it('should include X-XSS-Protection header', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      const xXssProtection = securityHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'X-XSS-Protection'
      );

      expect(xXssProtection).toBeDefined();
      expect(xXssProtection.value).toContain('1');
    });

    it('should include Referrer-Policy header', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      const referrerPolicy = securityHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'Referrer-Policy'
      );

      expect(referrerPolicy).toBeDefined();
      expect(referrerPolicy.value).toContain('origin');
    });

    it('should include Permissions-Policy header', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const securityHeaders = config.headers.find(
        (h: { source: string }) => h.source === '/:path*'
      );

      const permissionsPolicy = securityHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'Permissions-Policy'
      );

      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy.value).toContain('camera=()');
      expect(permissionsPolicy.value).toContain('microphone=()');
    });
  });

  describe('API route cache headers', () => {
    it('should configure no-cache headers for API routes', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const apiHeaders = config.headers.find((h: { source: string }) => h.source.includes('/api'));

      expect(apiHeaders).toBeDefined();

      const cacheControl = apiHeaders?.headers?.find(
        (header: { key: string }) => header.key === 'Cache-Control'
      );

      expect(cacheControl).toBeDefined();
      expect(cacheControl.value).toContain('no-store');
      expect(cacheControl.value).toContain('no-cache');
    });
  });

  describe('Region configuration', () => {
    it('should have regions configuration', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.regions).toBeDefined();
    });

    it('should configure at least one region', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(Array.isArray(config.regions)).toBe(true);
      expect(config.regions.length).toBeGreaterThanOrEqual(1);
    });

    it('should configure valid Vercel region codes', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Valid Vercel region codes
      const validRegions = [
        'arn1',
        'bom1',
        'cdg1',
        'cle1',
        'cpt1',
        'dub1',
        'fra1',
        'gru1',
        'hkg1',
        'hnd1',
        'iad1',
        'icn1',
        'kix1',
        'lhr1',
        'pdx1',
        'sfo1',
        'sin1',
        'syd1',
      ];

      config.regions.forEach((region: string) => {
        expect(validRegions).toContain(region);
      });
    });
  });

  describe('Crons configuration', () => {
    it('should have crons configuration (even if empty)', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.crons).toBeDefined();
      expect(Array.isArray(config.crons)).toBe(true);
    });
  });

  describe('Build configuration', () => {
    it('should not have conflicting build settings with Next.js', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // buildCommand and outputDirectory should not be set for Next.js projects
      // as Vercel auto-detects these
      expect(config.buildCommand).toBeUndefined();
      expect(config.outputDirectory).toBeUndefined();
    });

    it('should not override framework detection', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // framework should not be set explicitly for auto-detection
      expect(config.framework).toBeUndefined();
    });
  });

  describe('Environment compatibility', () => {
    it('should not have legacy routes configuration for App Router', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Routes should not be used with Next.js App Router
      // as middleware and route handlers handle routing
      expect(config.routes).toBeUndefined();
    });

    it('should not have rewrites that conflict with Next.js routing', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Rewrites are typically handled by next.config.js in Next.js 14+
      expect(config.rewrites).toBeUndefined();
    });
  });
});
