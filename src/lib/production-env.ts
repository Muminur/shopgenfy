import { z } from 'zod';

const productionEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  NANO_BANANA_API_KEY: z.string().min(1, 'NANO_BANANA_API_KEY is required'),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Invalid MongoDB URI format'),
  MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProductionReadiness {
  ready: boolean;
  checks: {
    environment: boolean;
    rateLimiting: boolean;
    errorTracking: boolean;
    database: boolean;
    apiKeys: boolean;
  };
  issues: string[];
}

export function validateProductionEnv(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  const parsed = productionEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    result.isValid = false;
    const fieldErrors = parsed.error.flatten().fieldErrors;

    Object.entries(fieldErrors).forEach(([key, messages]) => {
      if (messages && messages.length > 0) {
        result.errors.push(`${key}: ${messages.join(', ')}`);
      }
    });
  }

  // Check for optional but recommended variables
  const optionalVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_DRIVE_FOLDER_ID'];
  optionalVars.forEach((varName) => {
    if (!process.env[varName]) {
      result.warnings.push(`${varName} is not set - Google Drive features will be disabled`);
    }
  });

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    result.warnings.push('NEXT_PUBLIC_APP_URL is not set - some features may not work correctly');
  }

  return result;
}

export function checkProductionReadiness(): ProductionReadiness {
  const isProduction = process.env.NODE_ENV === 'production';
  const envValidation = validateProductionEnv();

  const checks = {
    environment: isProduction,
    rateLimiting: true, // Rate limiting is enabled via src/lib/middleware/rate-limiter.ts
    errorTracking: !!process.env.SENTRY_DSN, // Optional: true if Sentry DSN is configured
    database: !!process.env.MONGODB_URI,
    apiKeys: !!process.env.GEMINI_API_KEY && !!process.env.NANO_BANANA_API_KEY,
  };

  const issues: string[] = [];

  if (!checks.environment && process.env.VERCEL_ENV === 'production') {
    issues.push('NODE_ENV is not set to production');
  }

  if (!checks.database) {
    issues.push('Database connection string is missing');
  }

  if (!checks.apiKeys) {
    issues.push('Required API keys are missing');
  }

  envValidation.errors.forEach((error) => issues.push(error));

  return {
    ready: issues.length === 0 && envValidation.isValid,
    checks,
    issues,
  };
}

export function getDeploymentInfo(): {
  platform: string;
  region: string;
  commitSha: string;
  branch: string;
} {
  return {
    platform: process.env.VERCEL ? 'vercel' : 'local',
    region: process.env.VERCEL_REGION || 'unknown',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
  };
}
