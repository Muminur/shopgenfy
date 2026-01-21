import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Deployment Readiness Verification', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Required Configuration Files', () => {
    it('should have vercel.json in project root', () => {
      const configPath = join(process.cwd(), 'vercel.json');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have next.config.mjs in project root', () => {
      const configPath = join(process.cwd(), 'next.config.mjs');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have .env.example in project root', () => {
      const configPath = join(process.cwd(), '.env.example');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have playwright.config.ts in project root', () => {
      const configPath = join(process.cwd(), 'playwright.config.ts');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have vitest.config.ts in project root', () => {
      const configPath = join(process.cwd(), 'vitest.config.ts');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should have CI workflow in .github/workflows', () => {
      const configPath = join(process.cwd(), '.github', 'workflows', 'ci.yml');
      expect(existsSync(configPath)).toBe(true);
    });
  });

  describe('.env.example completeness', () => {
    const envExamplePath = join(process.cwd(), '.env.example');

    it('should include GEMINI_API_KEY', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('GEMINI_API_KEY');
    });

    it('should include NANO_BANANA_API_KEY', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('NANO_BANANA_API_KEY');
    });

    it('should include MONGODB_URI', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('MONGODB_URI');
    });

    it('should include MONGODB_DB_NAME', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('MONGODB_DB_NAME');
    });

    it('should include GOOGLE_CLIENT_ID', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('GOOGLE_CLIENT_ID');
    });

    it('should include GOOGLE_CLIENT_SECRET', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('GOOGLE_CLIENT_SECRET');
    });

    it('should include GOOGLE_DRIVE_FOLDER_ID', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('GOOGLE_DRIVE_FOLDER_ID');
    });

    it('should include GOOGLE_REFRESH_TOKEN', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('GOOGLE_REFRESH_TOKEN');
    });

    it('should include NEXT_PUBLIC_APP_URL', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('NEXT_PUBLIC_APP_URL');
    });

    it('should not contain actual secret values (only keys)', () => {
      const content = readFileSync(envExamplePath, 'utf-8');
      // Check that lines are either comments, empty, or key= format without actual values
      const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
      lines.forEach((line) => {
        // Each non-comment line should end with = (empty value) or have a very short placeholder
        const [key, value] = line.split('=');
        expect(key).toBeDefined();
        // Value should be empty or a placeholder
        if (value) {
          expect(value.length).toBeLessThan(50); // No real API keys
        }
      });
    });
  });

  describe('Vercel Configuration', () => {
    const vercelConfigPath = join(process.cwd(), 'vercel.json');

    it('should have valid JSON', () => {
      const content = readFileSync(vercelConfigPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should configure function timeout to 60 seconds', () => {
      const content = readFileSync(vercelConfigPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.functions).toBeDefined();
      const apiConfig = config.functions['api/**/*.ts'];
      expect(apiConfig).toBeDefined();
      expect(apiConfig.maxDuration).toBe(60);
    });

    it('should configure security headers', () => {
      const content = readFileSync(vercelConfigPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.headers).toBeDefined();
      expect(Array.isArray(config.headers)).toBe(true);
    });

    it('should configure deployment region', () => {
      const content = readFileSync(vercelConfigPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.regions).toBeDefined();
      expect(Array.isArray(config.regions)).toBe(true);
      expect(config.regions.length).toBeGreaterThan(0);
    });
  });

  describe('CI Pipeline Configuration', () => {
    const ciConfigPath = join(process.cwd(), '.github', 'workflows', 'ci.yml');

    it('should have lint-and-typecheck job', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('lint-and-typecheck');
    });

    it('should have test job', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('test:');
    });

    it('should have build job', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('build:');
    });

    it('should use Node.js 20', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain("node-version: '20'");
    });

    it('should use MongoDB service', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('mongodb:');
      expect(content).toContain('mongo:7');
    });

    it('should trigger on push to main', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('push:');
      expect(content).toContain('branches: [main]');
    });

    it('should trigger on pull request to main', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('pull_request:');
    });

    it('should have e2e test job', () => {
      const content = readFileSync(ciConfigPath, 'utf-8');
      expect(content).toContain('e2e');
    });
  });

  describe('Next.js Configuration', () => {
    const nextConfigPath = join(process.cwd(), 'next.config.mjs');

    it('should have reactStrictMode enabled', () => {
      const content = readFileSync(nextConfigPath, 'utf-8');
      expect(content).toContain('reactStrictMode: true');
    });

    it('should have standalone output for Vercel', () => {
      const content = readFileSync(nextConfigPath, 'utf-8');
      expect(content).toContain("output: 'standalone'");
    });

    it('should have image optimization configured', () => {
      const content = readFileSync(nextConfigPath, 'utf-8');
      expect(content).toContain('images:');
      expect(content).toContain('formats:');
    });

    it('should have security headers', () => {
      const content = readFileSync(nextConfigPath, 'utf-8');
      expect(content).toContain('X-Content-Type-Options');
      expect(content).toContain('X-Frame-Options');
      expect(content).toContain('X-XSS-Protection');
    });
  });

  describe('Package.json Scripts', () => {
    const packageJsonPath = join(process.cwd(), 'package.json');

    it('should have dev script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.dev).toBeDefined();
    });

    it('should have build script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.build).toBeDefined();
    });

    it('should have start script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.start).toBeDefined();
    });

    it('should have lint script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.lint).toBeDefined();
    });

    it('should have test script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.test).toBeDefined();
    });

    it('should have type-check script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts['type-check']).toBeDefined();
    });

    it('should have test:e2e script', () => {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts['test:e2e']).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    it('should have health check endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'health', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });

    it('should have status endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'status', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });

    it('should have gemini models endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'gemini', 'models', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });

    it('should have submissions endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'submissions', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });

    it('should have settings endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'settings', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });

    it('should have export endpoint', () => {
      const routePath = join(process.cwd(), 'src', 'app', 'api', 'export', '[id]', 'route.ts');
      expect(existsSync(routePath)).toBe(true);
    });
  });

  describe('Core Library Files', () => {
    it('should have env validation', () => {
      const filePath = join(process.cwd(), 'src', 'lib', 'env.ts');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have production env validation', () => {
      const filePath = join(process.cwd(), 'src', 'lib', 'production-env.ts');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have mongodb connection', () => {
      const filePath = join(process.cwd(), 'src', 'lib', 'mongodb.ts');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have rate limiter middleware', () => {
      const filePath = join(process.cwd(), 'src', 'lib', 'middleware', 'rate-limiter.ts');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have error logger', () => {
      const filePath = join(process.cwd(), 'src', 'lib', 'error-logger.ts');
      expect(existsSync(filePath)).toBe(true);
    });
  });
});
