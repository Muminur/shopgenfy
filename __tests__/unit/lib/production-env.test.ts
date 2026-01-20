import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Production Environment Utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('validateProductionEnv', () => {
    it('should return valid when all required env vars are set', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when GEMINI_API_KEY is missing', async () => {
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // GEMINI_API_KEY not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('GEMINI_API_KEY'))).toBe(true);
    });

    it('should return invalid when NANO_BANANA_API_KEY is missing', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // NANO_BANANA_API_KEY not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('NANO_BANANA_API_KEY'))).toBe(true);
    });

    it('should return invalid when MONGODB_URI is missing', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // MONGODB_URI not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('MONGODB_URI'))).toBe(true);
    });

    it('should return invalid when MONGODB_URI has invalid format', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'invalid-uri');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('MONGODB_URI'))).toBe(true);
    });

    it('should accept mongodb+srv:// URI format', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb+srv://user:pass@cluster.mongodb.net');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
    });

    it('should return invalid when MONGODB_DB_NAME is missing', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      // MONGODB_DB_NAME not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('MONGODB_DB_NAME'))).toBe(true);
    });

    it('should include warnings for missing optional Google Drive vars', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // Google Drive vars not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('GOOGLE_CLIENT_ID'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('GOOGLE_CLIENT_SECRET'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('GOOGLE_DRIVE_FOLDER_ID'))).toBe(true);
    });

    it('should include warning for missing NEXT_PUBLIC_APP_URL', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // NEXT_PUBLIC_APP_URL not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('NEXT_PUBLIC_APP_URL'))).toBe(true);
    });

    it('should return no warnings when all optional vars are set', async () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
      vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID', 'test-folder-id');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('checkProductionReadiness', () => {
    it('should return ready when all requirements are met', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.checks.apiKeys).toBe(true);
      expect(result.checks.database).toBe(true);
    });

    it('should return not ready when API keys are missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // API keys not set

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.apiKeys).toBe(false);
      expect(result.issues.some((i) => i.includes('API keys'))).toBe(true);
    });

    it('should return not ready when database URI is missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');
      // MONGODB_URI not set

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe(false);
      expect(result.issues.some((i) => i.includes('Database'))).toBe(true);
    });

    it('should detect non-production environment', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.environment).toBe(false);
    });

    it('should set environment check true in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.environment).toBe(true);
    });

    it('should include validation errors in issues', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'invalid-uri'); // Invalid format
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(false);
      expect(result.issues.some((i) => i.includes('MONGODB_URI'))).toBe(true);
    });

    it('should return proper checks structure', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test_db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('issues');
      expect(result.checks).toHaveProperty('environment');
      expect(result.checks).toHaveProperty('rateLimiting');
      expect(result.checks).toHaveProperty('errorTracking');
      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('apiKeys');
    });
  });

  describe('getDeploymentInfo', () => {
    it('should return local platform when not on Vercel', async () => {
      // Don't set any Vercel env vars
      vi.resetModules();

      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result.platform).toBe('local');
      expect(result.region).toBe('unknown');
      expect(result.commitSha).toBe('local');
      expect(result.branch).toBe('local');
    });

    it('should return Vercel info when deployed on Vercel', async () => {
      vi.stubEnv('VERCEL', '1');
      vi.stubEnv('VERCEL_REGION', 'iad1');
      vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
      vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main');

      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result.platform).toBe('vercel');
      expect(result.region).toBe('iad1');
      expect(result.commitSha).toBe('abc123');
      expect(result.branch).toBe('main');
    });

    it('should return proper structure', async () => {
      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('region');
      expect(result).toHaveProperty('commitSha');
      expect(result).toHaveProperty('branch');
    });
  });
});
