import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db } from 'mongodb';
import { createAPIVersionManager, type APIVersionManager } from '@/lib/api-version-manager';
import { type GeminiClient } from '@/lib/gemini';
import { type NanoBananaClient } from '@/lib/nanobanana';
import { COLLECTIONS } from '@/lib/db/collections';

/**
 * Integration tests for API Version Manager
 * Tests full workflow with real database and mocked API clients
 * Focuses on: version tracking, auto-updates, rollback mechanisms
 */
describe('API Version Manager - Integration Tests', () => {
  let client: MongoClient;
  let db: Db;
  let manager: APIVersionManager;
  let mockGeminiClient: GeminiClient;
  let mockNanoBananaClient: NanoBananaClient;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db('shopify_test_api_versions');
  });

  afterAll(async () => {
    if (db) {
      await db.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  beforeEach(async () => {
    await db.collection(COLLECTIONS.API_VERSIONS).deleteMany({});

    mockGeminiClient = {
      listModels: async () => [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Best model for text generation',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
      ],
      generateContent: async (_prompt, _options) => ({
        text: 'Health check response',
        finishReason: 'STOP',
        usage: { promptTokens: 5, outputTokens: 10, totalTokens: 15 },
      }),
      generateContentStream: async function* (_prompt, _options) {
        yield { text: 'chunk1' };
      },
      analyzeUrl: async (_url) => ({
        appName: 'Test App',
        appIntroduction: 'Test intro',
        appDescription: 'Test description',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Store design',
        featureTags: ['test'],
        pricing: { type: 'free' as const },
        confidence: 0.9,
      }),
    };

    mockNanoBananaClient = {
      generateImage: async (_request, _options) => ({
        jobId: 'job-123',
        status: 'completed' as const,
        imageUrl: 'https://cdn.nanobanana.io/test.png',
        width: 1200,
        height: 1200,
        format: 'png' as const,
      }),
      generateBatch: async (_requests, _options) => [],
      getJobStatus: async (jobId) => ({
        jobId,
        status: 'completed' as const,
      }),
      checkVersion: async () => ({
        version: '2.0.0',
        releaseDate: '2026-01-01',
        features: ['batch-generation', 'style-presets'],
      }),
    };

    manager = createAPIVersionManager(db, mockGeminiClient, mockNanoBananaClient);
  });

  describe('Full Version Check Workflow', () => {
    it('should initialize Gemini version on first check', async () => {
      const result = await manager.checkGeminiVersion();

      expect(result.hasUpdate).toBe(false);
      expect(result.currentVersion).toBe('v1beta');
      expect(result.latestVersion).toBe('v1beta');
      expect(result.availableVersions).toContain('v1beta');

      const stored = await db.collection(COLLECTIONS.API_VERSIONS).findOne({ service: 'gemini' });
      expect(stored).toBeDefined();
      expect(stored?.currentVersion).toBe('v1beta');
      expect(stored?.lastKnownGood).toBe('v1beta');
    });

    it('should initialize Nano Banana version on first check', async () => {
      const result = await manager.checkNanoBananaVersion();

      expect(result.hasUpdate).toBe(false);
      expect(result.currentVersion).toBe('2.0.0');
      expect(result.latestVersion).toBe('2.0.0');

      const stored = await db
        .collection(COLLECTIONS.API_VERSIONS)
        .findOne({ service: 'nanobanana' });
      expect(stored).toBeDefined();
      expect(stored?.currentVersion).toBe('2.0.0');
    });

    it('should detect new Gemini version on subsequent check', async () => {
      await manager.checkGeminiVersion();

      mockGeminiClient.listModels = async () => [
        {
          name: 'models/gemini-pro-v2',
          displayName: 'Gemini Pro V2',
          description: 'Next generation model',
          inputTokenLimit: 40960,
          outputTokenLimit: 4096,
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      const result = await manager.checkGeminiVersion();

      expect(result.hasUpdate).toBe(true);
      expect(result.currentVersion).toBe('v1beta');
      expect(result.latestVersion).toBe('v2');
    });

    it('should detect new Nano Banana version on subsequent check', async () => {
      await manager.checkNanoBananaVersion();

      mockNanoBananaClient.checkVersion = async () => ({
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: ['hd-quality', 'batch-generation'],
      });

      const result = await manager.checkNanoBananaVersion();

      expect(result.hasUpdate).toBe(true);
      expect(result.currentVersion).toBe('2.0.0');
      expect(result.latestVersion).toBe('2.1.0');
    });
  });

  describe('Version Update with Health Checks', () => {
    it('should successfully update Gemini version after health check', async () => {
      await manager.checkGeminiVersion();

      const updateResult = await manager.updateGeminiVersion('v2');

      expect(updateResult.success).toBe(true);
      expect(updateResult.version).toBe('v2');
      expect(updateResult.previousVersion).toBe('v1beta');

      const stored = await db.collection(COLLECTIONS.API_VERSIONS).findOne({ service: 'gemini' });
      expect(stored?.currentVersion).toBe('v2');
      expect(stored?.lastKnownGood).toBe('v2');
    });

    it('should rollback Gemini version on health check failure', async () => {
      await manager.checkGeminiVersion();

      mockGeminiClient.generateContent = async () => {
        throw new Error('API error');
      };

      const updateResult = await manager.updateGeminiVersion('v2');

      expect(updateResult.success).toBe(false);
      expect(updateResult.rolledBack).toBe(true);
      expect(updateResult.version).toBe('v1beta');
      expect(updateResult.error).toContain('Health check failed');

      const stored = await db.collection(COLLECTIONS.API_VERSIONS).findOne({ service: 'gemini' });
      expect(stored?.currentVersion).toBe('v1beta');
    });

    it('should successfully update Nano Banana version after health check', async () => {
      await manager.checkNanoBananaVersion();

      const updateResult = await manager.updateNanoBananaVersion('2.1.0');

      expect(updateResult.success).toBe(true);
      expect(updateResult.version).toBe('2.1.0');

      const stored = await db
        .collection(COLLECTIONS.API_VERSIONS)
        .findOne({ service: 'nanobanana' });
      expect(stored?.currentVersion).toBe('2.1.0');
      expect(stored?.lastKnownGood).toBe('2.1.0');
    });

    it('should rollback Nano Banana version on health check failure', async () => {
      await manager.checkNanoBananaVersion();

      mockNanoBananaClient.checkVersion = async () => {
        throw new Error('Service unavailable');
      };

      const updateResult = await manager.updateNanoBananaVersion('2.1.0');

      expect(updateResult.success).toBe(false);
      expect(updateResult.rolledBack).toBe(true);
      expect(updateResult.version).toBe('2.0.0');

      const stored = await db
        .collection(COLLECTIONS.API_VERSIONS)
        .findOne({ service: 'nanobanana' });
      expect(stored?.currentVersion).toBe('2.0.0');
    });
  });

  describe('Auto-Update All Services', () => {
    it('should check and update all services when updates available', async () => {
      await manager.checkGeminiVersion();
      await manager.checkNanoBananaVersion();

      mockGeminiClient.listModels = async () => [
        {
          name: 'models/gemini-pro-v2',
          displayName: 'Gemini Pro V2',
          description: 'Next generation',
          inputTokenLimit: 40960,
          outputTokenLimit: 4096,
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      mockNanoBananaClient.checkVersion = async () => ({
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: ['hd-quality'],
      });

      const results = await manager.autoUpdateAll();

      expect(results.gemini.checked).toBe(true);
      expect(results.gemini.hasUpdate).toBe(true);
      expect(results.gemini.updated).toBe(true);
      expect(results.gemini.version).toBe('v2');

      expect(results.nanobanana.checked).toBe(true);
      expect(results.nanobanana.hasUpdate).toBe(true);
      expect(results.nanobanana.updated).toBe(true);
      expect(results.nanobanana.version).toBe('2.1.0');
    });

    it('should handle partial failures gracefully', async () => {
      await manager.checkGeminiVersion();
      await manager.checkNanoBananaVersion();

      mockGeminiClient.listModels = async () => {
        throw new Error('Gemini API error');
      };

      mockNanoBananaClient.checkVersion = async () => ({
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: [],
      });

      const results = await manager.autoUpdateAll();

      expect(results.gemini.checked).toBe(false);
      expect(results.gemini.error).toBeDefined();

      expect(results.nanobanana.checked).toBe(true);
      expect(results.nanobanana.hasUpdate).toBe(true);
    });

    it('should not update when no new versions available', async () => {
      await manager.checkGeminiVersion();
      await manager.checkNanoBananaVersion();

      const results = await manager.autoUpdateAll();

      expect(results.gemini.checked).toBe(true);
      expect(results.gemini.hasUpdate).toBe(false);
      expect(results.gemini.updated).toBeUndefined();

      expect(results.nanobanana.checked).toBe(true);
      expect(results.nanobanana.hasUpdate).toBe(false);
      expect(results.nanobanana.updated).toBeUndefined();
    });
  });

  describe('Version History Tracking', () => {
    it('should track version history across updates', async () => {
      await manager.checkGeminiVersion();
      await manager.checkNanoBananaVersion();

      await manager.updateGeminiVersion('v2');
      await manager.updateNanoBananaVersion('2.1.0');

      const history = await manager.getVersionHistory();

      expect(history).toHaveLength(2);

      const geminiHistory = history.find((h) => h.service === 'gemini');
      expect(geminiHistory?.currentVersion).toBe('v2');
      expect(geminiHistory?.lastKnownGood).toBe('v2');

      const nanoBananaHistory = history.find((h) => h.service === 'nanobanana');
      expect(nanoBananaHistory?.currentVersion).toBe('2.1.0');
      expect(nanoBananaHistory?.lastKnownGood).toBe('2.1.0');
    });

    it('should maintain lastKnownGood after failed update', async () => {
      await manager.checkGeminiVersion();

      mockGeminiClient.generateContent = async () => {
        throw new Error('Health check failed');
      };

      await manager.updateGeminiVersion('v2');

      const history = await manager.getVersionHistory();
      const geminiHistory = history.find((h) => h.service === 'gemini');

      expect(geminiHistory?.currentVersion).toBe('v1beta');
      expect(geminiHistory?.lastKnownGood).toBe('v1beta');
    });
  });

  describe('Get Current Versions', () => {
    it('should return current versions for all services', async () => {
      await manager.checkGeminiVersion();
      await manager.checkNanoBananaVersion();

      const versions = await manager.getCurrentVersions();

      expect(versions.gemini).toBe('v1beta');
      expect(versions.nanobanana).toBe('2.0.0');
    });

    it('should return null for uninitialized services', async () => {
      const versions = await manager.getCurrentVersions();

      expect(versions.gemini).toBeNull();
      expect(versions.nanobanana).toBeNull();
    });

    it('should reflect updated versions', async () => {
      await manager.checkGeminiVersion();
      await manager.updateGeminiVersion('v2');

      const versions = await manager.getCurrentVersions();

      expect(versions.gemini).toBe('v2');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection issues gracefully', async () => {
      await client.close();

      await expect(manager.checkGeminiVersion()).rejects.toThrow();

      client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
      await client.connect();
      db = client.db('shopify_test_api_versions');
      manager = createAPIVersionManager(db, mockGeminiClient, mockNanoBananaClient);
    });

    it('should handle concurrent version checks', async () => {
      const checks = await Promise.all([
        manager.checkGeminiVersion(),
        manager.checkGeminiVersion(),
        manager.checkNanoBananaVersion(),
      ]);

      expect(checks).toHaveLength(3);
      expect(checks[0].currentVersion).toBe('v1beta');
      expect(checks[1].currentVersion).toBe('v1beta');
      expect(checks[2].currentVersion).toBe('2.0.0');
    });

    it('should maintain data integrity during rapid updates', async () => {
      await manager.checkGeminiVersion();

      await manager.updateGeminiVersion('v2');

      const stored = await db.collection(COLLECTIONS.API_VERSIONS).findOne({ service: 'gemini' });

      expect(stored?.currentVersion).toBe('v2');
      expect(stored?.lastKnownGood).toBe('v2');
      expect(stored?.availableVersions).toContain('v2');
    });

    it('should handle empty response from API gracefully', async () => {
      mockGeminiClient.listModels = async () => [];

      const result = await manager.checkGeminiVersion();

      expect(result.currentVersion).toBe('v1beta');
    });

    it('should update availableVersions list on each check', async () => {
      await manager.checkGeminiVersion();

      mockGeminiClient.listModels = async () => [
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Text model',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-pro-v2',
          displayName: 'Gemini Pro V2',
          description: 'Next gen',
          inputTokenLimit: 40960,
          outputTokenLimit: 4096,
          supportedGenerationMethods: ['generateContent'],
        },
      ];

      await manager.checkGeminiVersion();

      const stored = await db.collection(COLLECTIONS.API_VERSIONS).findOne({ service: 'gemini' });
      expect(stored?.availableVersions.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Mechanism', () => {
    it('should use lastKnownGood when current version fails', async () => {
      await manager.checkGeminiVersion();
      await manager.updateGeminiVersion('v2');

      const firstCheck = await db
        .collection(COLLECTIONS.API_VERSIONS)
        .findOne({ service: 'gemini' });
      expect(firstCheck?.lastKnownGood).toBe('v2');

      mockGeminiClient.generateContent = async () => {
        throw new Error('Version v3 is broken');
      };

      const updateResult = await manager.updateGeminiVersion('v3');

      expect(updateResult.success).toBe(false);
      expect(updateResult.version).toBe('v2');
      expect(updateResult.rolledBack).toBe(true);

      const afterFailed = await db
        .collection(COLLECTIONS.API_VERSIONS)
        .findOne({ service: 'gemini' });
      expect(afterFailed?.currentVersion).toBe('v2');
      expect(afterFailed?.lastKnownGood).toBe('v2');
    });

    it('should maintain version history through rollbacks', async () => {
      await manager.checkGeminiVersion();
      await manager.updateGeminiVersion('v2');

      mockGeminiClient.generateContent = async () => {
        throw new Error('Failure');
      };

      // Attempt to update to v3, which will fail health check
      await manager.updateGeminiVersion('v3');

      const history = await manager.getVersionHistory();
      const geminiVersion = history.find((h) => h.service === 'gemini');

      // Failed versions should not be added to availableVersions
      expect(geminiVersion?.availableVersions).toContain('v1beta');
      expect(geminiVersion?.availableVersions).toContain('v2');
      expect(geminiVersion?.availableVersions).not.toContain('v3');
      expect(geminiVersion?.currentVersion).toBe('v2');
      expect(geminiVersion?.lastKnownGood).toBe('v2');
    });
  });
});
