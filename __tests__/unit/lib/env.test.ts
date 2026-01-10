import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// We need to test the schema and validation logic without triggering the module-level validation
// So we recreate the schema here for testing purposes
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  NANO_BANANA_API_KEY: z.string().min(1, 'NANO_BANANA_API_KEY is required'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

function validateEnv(envVars: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(envVars);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessage = Object.entries(errors)
      .map(([key, messages]) => `${key}: ${messages?.join(', ')}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessage}`);
  }

  return parsed.data;
}

describe('Environment Validation', () => {
  describe('envSchema', () => {
    it('should validate complete valid environment', () => {
      const validEnv = {
        GEMINI_API_KEY: 'test-gemini-key',
        NANO_BANANA_API_KEY: 'test-nano-banana-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_DRIVE_FOLDER_ID: 'folder-id',
        GOOGLE_REFRESH_TOKEN: 'refresh-token',
        NEXT_PUBLIC_APP_URL: 'https://example.com',
      };

      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalEnv = {
        GEMINI_API_KEY: 'test-gemini-key',
        NANO_BANANA_API_KEY: 'test-nano-banana-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(minimalEnv);
      expect(result.success).toBe(true);
    });

    it('should fail when GEMINI_API_KEY is missing', () => {
      const envWithoutGemini = {
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(envWithoutGemini);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.GEMINI_API_KEY).toBeDefined();
      }
    });

    it('should fail when NANO_BANANA_API_KEY is missing', () => {
      const envWithoutNanoBanana = {
        GEMINI_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(envWithoutNanoBanana);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.NANO_BANANA_API_KEY).toBeDefined();
      }
    });

    it('should fail when MONGODB_URI is missing', () => {
      const envWithoutMongo = {
        GEMINI_API_KEY: 'test-key',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(envWithoutMongo);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.MONGODB_URI).toBeDefined();
      }
    });

    it('should fail when MONGODB_DB_NAME is missing', () => {
      const envWithoutDbName = {
        GEMINI_API_KEY: 'test-key',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
      };

      const result = envSchema.safeParse(envWithoutDbName);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.MONGODB_DB_NAME).toBeDefined();
      }
    });

    it('should fail when GEMINI_API_KEY is empty string', () => {
      const envWithEmptyKey = {
        GEMINI_API_KEY: '',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(envWithEmptyKey);
      expect(result.success).toBe(false);
    });

    it('should fail when NEXT_PUBLIC_APP_URL is invalid URL', () => {
      const envWithInvalidUrl = {
        GEMINI_API_KEY: 'test-key',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
        NEXT_PUBLIC_APP_URL: 'not-a-valid-url',
      };

      const result = envSchema.safeParse(envWithInvalidUrl);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.NEXT_PUBLIC_APP_URL).toBeDefined();
      }
    });

    it('should allow optional Google credentials to be undefined', () => {
      const envWithoutGoogle = {
        GEMINI_API_KEY: 'test-key',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = envSchema.safeParse(envWithoutGoogle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GOOGLE_CLIENT_ID).toBeUndefined();
        expect(result.data.GOOGLE_CLIENT_SECRET).toBeUndefined();
        expect(result.data.GOOGLE_DRIVE_FOLDER_ID).toBeUndefined();
      }
    });
  });

  describe('validateEnv function', () => {
    it('should return validated env when all required fields present', () => {
      const validEnv = {
        GEMINI_API_KEY: 'test-gemini-key',
        NANO_BANANA_API_KEY: 'test-nano-banana-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = validateEnv(validEnv);
      expect(result.GEMINI_API_KEY).toBe('test-gemini-key');
      expect(result.NANO_BANANA_API_KEY).toBe('test-nano-banana-key');
      expect(result.MONGODB_URI).toBe('mongodb://localhost:27017');
      expect(result.MONGODB_DB_NAME).toBe('test-db');
    });

    it('should throw error with formatted message when validation fails', () => {
      const invalidEnv = {
        // Missing all required fields
      };

      expect(() => validateEnv(invalidEnv)).toThrow('Environment validation failed:');
    });

    it('should include field names in error message', () => {
      const invalidEnv = {
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
        // Missing GEMINI_API_KEY and NANO_BANANA_API_KEY
      };

      try {
        validateEnv(invalidEnv);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('GEMINI_API_KEY');
        expect((error as Error).message).toContain('NANO_BANANA_API_KEY');
      }
    });

    it('should handle multiple validation errors', () => {
      const invalidEnv = {};

      try {
        validateEnv(invalidEnv);
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('GEMINI_API_KEY');
        expect(errorMessage).toContain('NANO_BANANA_API_KEY');
        expect(errorMessage).toContain('MONGODB_URI');
        expect(errorMessage).toContain('MONGODB_DB_NAME');
      }
    });

    it('should preserve optional fields when provided', () => {
      const envWithOptionals = {
        GEMINI_API_KEY: 'test-gemini-key',
        NANO_BANANA_API_KEY: 'test-nano-banana-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_DRIVE_FOLDER_ID: 'folder-id',
        GOOGLE_REFRESH_TOKEN: 'refresh-token',
        NEXT_PUBLIC_APP_URL: 'https://example.com',
      };

      const result = validateEnv(envWithOptionals);
      expect(result.GOOGLE_CLIENT_ID).toBe('client-id');
      expect(result.GOOGLE_CLIENT_SECRET).toBe('client-secret');
      expect(result.GOOGLE_DRIVE_FOLDER_ID).toBe('folder-id');
      expect(result.GOOGLE_REFRESH_TOKEN).toBe('refresh-token');
      expect(result.NEXT_PUBLIC_APP_URL).toBe('https://example.com');
    });
  });

  describe('Type inference', () => {
    it('should infer correct types for required fields', () => {
      const validEnv = {
        GEMINI_API_KEY: 'test-key',
        NANO_BANANA_API_KEY: 'test-key',
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB_NAME: 'test-db',
      };

      const result = validateEnv(validEnv);

      // TypeScript compile-time checks
      const geminiKey: string = result.GEMINI_API_KEY;
      const nanoBananaKey: string = result.NANO_BANANA_API_KEY;
      const mongoUri: string = result.MONGODB_URI;
      const dbName: string = result.MONGODB_DB_NAME;

      expect(typeof geminiKey).toBe('string');
      expect(typeof nanoBananaKey).toBe('string');
      expect(typeof mongoUri).toBe('string');
      expect(typeof dbName).toBe('string');
    });
  });
});
