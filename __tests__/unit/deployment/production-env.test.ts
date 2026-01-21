import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Production Environment Validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('validateProductionEnv', () => {
    it('should validate required production environment variables', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required variables in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', ''); // Explicitly set to empty
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('GEMINI_API_KEY'))).toBe(true);
    });

    it('should validate MONGODB_URI format', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'invalid-uri'); // Invalid format (not mongodb://)
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('MONGODB_URI'))).toBe(true);
    });

    it('should warn about optional Google Drive variables', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');
      // GOOGLE_CLIENT_ID not set

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.warnings).toBeDefined();
      expect(result.warnings.some((w) => w.includes('GOOGLE_CLIENT_ID'))).toBe(true);
    });

    it('should accept valid mongodb+srv URI format', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb+srv://user:pass@cluster.mongodb.net');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(true);
    });

    it('should return error for missing NANO_BANANA_API_KEY', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', ''); // Explicitly set to empty
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('NANO_BANANA_API_KEY'))).toBe(true);
    });

    it('should return error for missing MONGODB_DB_NAME', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', ''); // Explicitly set to empty

      const { validateProductionEnv } = await import('@/lib/production-env');
      const result = validateProductionEnv();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('MONGODB_DB_NAME'))).toBe(true);
    });
  });

  describe('checkProductionReadiness', () => {
    it('should check rate limiting is enabled in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.rateLimiting).toBeDefined();
    });

    it('should verify environment is production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.environment).toBe(true);
    });

    it('should return not ready when in development environment', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.environment).toBe(false);
    });

    it('should check error tracking configuration', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.errorTracking).toBeDefined();
    });

    it('should check API keys configuration', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.apiKeys).toBe(true);
    });

    it('should check database configuration', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.checks.database).toBe(true);
    });

    it('should report not ready when API keys missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', ''); // Explicitly set to empty
      vi.stubEnv('NANO_BANANA_API_KEY', ''); // Explicitly set to empty
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.apiKeys).toBe(false);
    });

    it('should report not ready when database config missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', ''); // Explicitly set to empty
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe(false);
    });

    it('should return issues array with specific problems', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', ''); // Explicitly set to empty
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should return proper structure with all checks', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
      vi.stubEnv('NANO_BANANA_API_KEY', 'test-nanobanana-key');
      vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
      vi.stubEnv('MONGODB_DB_NAME', 'test-db');

      const { checkProductionReadiness } = await import('@/lib/production-env');
      const result = checkProductionReadiness();

      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('issues');
      expect(typeof result.ready).toBe('boolean');
      expect(typeof result.checks).toBe('object');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('getDeploymentInfo', () => {
    it('should return deployment info structure', async () => {
      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('region');
      expect(result).toHaveProperty('commitSha');
      expect(result).toHaveProperty('branch');
    });

    it('should detect Vercel platform when deployed', async () => {
      vi.stubEnv('VERCEL', '1');
      vi.stubEnv('VERCEL_REGION', 'iad1');

      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result.platform).toBe('vercel');
      expect(result.region).toBe('iad1');
    });

    it('should return local platform when not on Vercel', async () => {
      // VERCEL and VERCEL_REGION not set
      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result.platform).toBe('local');
    });

    it('should include git commit information', async () => {
      vi.stubEnv('VERCEL', '1');
      vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123def456');
      vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main');

      const { getDeploymentInfo } = await import('@/lib/production-env');
      const result = getDeploymentInfo();

      expect(result.commitSha).toBe('abc123def456');
      expect(result.branch).toBe('main');
    });
  });
});
