import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Db } from 'mongodb';
import { createAPIVersionManager, type APIVersionManager } from '@/lib/api-version-manager';
import type { GeminiClient } from '@/lib/gemini';
import type { NanoBananaClient } from '@/lib/nanobanana';

/**
 * Unit tests for API Version Manager
 * Tests version checking, auto-update logic, fallback mechanisms
 */
describe('API Version Manager - Unit Tests', () => {
  let mockDb: Db;
  let mockGeminiClient: GeminiClient;
  let mockNanoBananaClient: NanoBananaClient;
  let manager: APIVersionManager;

  beforeEach(() => {
    mockDb = {
      collection: vi.fn(() => ({
        findOne: vi.fn(),
        insertOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
      })),
    } as unknown as Db;

    mockGeminiClient = {
      listModels: vi.fn(),
      generateContent: vi.fn(),
      generateContentStream: vi.fn(),
      analyzeUrl: vi.fn(),
    };

    mockNanoBananaClient = {
      generateImage: vi.fn(),
      regenerateImage: vi.fn(),
      generateBatch: vi.fn(),
      getJobStatus: vi.fn(),
      checkVersion: vi.fn(),
    };

    manager = createAPIVersionManager(mockDb, mockGeminiClient, mockNanoBananaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkGeminiVersion', () => {
    it('should return current version when no updates available', async () => {
      const mockStoredVersion = {
        _id: 'version-123',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1', 'v1beta'],
        lastChecked: new Date(),
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(mockStoredVersion),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.listModels = vi
        .fn()
        .mockResolvedValueOnce([
          { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
        ]);

      const result = await manager.checkGeminiVersion();

      expect(result.hasUpdate).toBe(false);
      expect(result.currentVersion).toBe('v1beta');
      expect(result.latestVersion).toBe('v1beta');
    });

    it('should detect new version when API returns newer version', async () => {
      const mockObjectId = { toString: () => 'version-123' };
      const mockStoredVersion = {
        _id: mockObjectId,
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1', 'v1beta'],
        lastChecked: new Date(),
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(mockStoredVersion),
        findOneAndUpdate: vi.fn().mockResolvedValueOnce(mockStoredVersion),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.listModels = vi
        .fn()
        .mockResolvedValueOnce([
          { name: 'models/gemini-pro-v2', supportedGenerationMethods: ['generateContent'] },
        ]);

      const result = await manager.checkGeminiVersion();

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('v2');
    });

    it('should initialize version when none exists in database', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(null),
        insertOne: vi.fn().mockResolvedValueOnce({ insertedId: 'new-id' }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.listModels = vi
        .fn()
        .mockResolvedValueOnce([
          { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
        ]);

      const result = await manager.checkGeminiVersion();

      expect(mockCollection.insertOne).toHaveBeenCalled();
      expect(result.currentVersion).toBe('v1beta');
    });

    it('should handle API errors gracefully', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          service: 'gemini',
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date(),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.listModels = vi.fn().mockRejectedValueOnce(new Error('API unavailable'));

      await expect(manager.checkGeminiVersion()).rejects.toThrow('Failed to check Gemini version');
    });
  });

  describe('checkNanoBananaVersion', () => {
    it('should return current version when no updates available', async () => {
      const mockStoredVersion = {
        _id: 'version-456',
        service: 'nanobanana' as const,
        currentVersion: '2.0.0',
        lastKnownGood: '2.0.0',
        availableVersions: ['2.0.0'],
        lastChecked: new Date(),
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(mockStoredVersion),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.0.0',
        releaseDate: '2026-01-01',
        features: [],
      });

      const result = await manager.checkNanoBananaVersion();

      expect(result.hasUpdate).toBe(false);
      expect(result.currentVersion).toBe('2.0.0');
    });

    it('should detect new version from Nano Banana API', async () => {
      const mockObjectId = { toString: () => 'version-456' };
      const mockStoredVersion = {
        _id: mockObjectId,
        service: 'nanobanana' as const,
        currentVersion: '2.0.0',
        lastKnownGood: '2.0.0',
        availableVersions: ['2.0.0'],
        lastChecked: new Date(),
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(mockStoredVersion),
        findOneAndUpdate: vi.fn().mockResolvedValueOnce(mockStoredVersion),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: ['hd-quality'],
      });

      const result = await manager.checkNanoBananaVersion();

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('2.1.0');
    });

    it('should initialize Nano Banana version when none exists', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce(null),
        insertOne: vi.fn().mockResolvedValueOnce({ insertedId: 'new-id' }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.0.0',
        releaseDate: '2026-01-01',
        features: [],
      });

      const result = await manager.checkNanoBananaVersion();

      expect(mockCollection.insertOne).toHaveBeenCalled();
      expect(result.currentVersion).toBe('2.0.0');
    });
  });

  describe('updateGeminiVersion', () => {
    it('should update to new version after health check', async () => {
      // Use a valid ObjectId string (24 hex characters)
      const validObjectIdString = '507f1f77bcf86cd799439011';
      const mockObjectId = { toString: () => validObjectIdString };
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'gemini',
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date(),
        }),
        findOneAndUpdate: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'gemini',
          currentVersion: 'v2',
          lastKnownGood: 'v2',
          availableVersions: ['v1beta', 'v2'],
          lastChecked: new Date(),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.generateContent = vi.fn().mockResolvedValueOnce({
        text: 'Health check success',
        finishReason: 'STOP',
        usage: { promptTokens: 5, outputTokens: 10, totalTokens: 15 },
      });

      const result = await manager.updateGeminiVersion('v2');

      expect(result.success).toBe(true);
      expect(result.version).toBe('v2');
      expect(collectionSpy).toHaveBeenCalled();
      expect(mockCollection.findOne).toHaveBeenCalled();
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should rollback to lastKnownGood on health check failure', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          service: 'gemini',
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date(),
        }),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.generateContent = vi
        .fn()
        .mockRejectedValueOnce(new Error('Health check failed'));

      const result = await manager.updateGeminiVersion('v2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Health check failed');
      expect(result.rolledBack).toBe(true);
      expect(result.version).toBe('v1beta');
    });

    it('should update lastKnownGood on successful update', async () => {
      // Use a valid ObjectId string (24 hex characters)
      const validObjectIdString = '507f1f77bcf86cd799439012';
      const mockObjectId = { toString: () => validObjectIdString };
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'gemini',
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date(),
        }),
        findOneAndUpdate: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'gemini',
          currentVersion: 'v2',
          lastKnownGood: 'v2',
          availableVersions: ['v1beta', 'v2'],
          lastChecked: new Date(),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.generateContent = vi.fn().mockResolvedValueOnce({
        text: 'Health check success',
        finishReason: 'STOP',
        usage: { promptTokens: 5, outputTokens: 10, totalTokens: 15 },
      });

      const result = await manager.updateGeminiVersion('v2');

      expect(result.success).toBe(true);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled();
      const updateCall = mockCollection.findOneAndUpdate.mock.calls[0];
      expect(updateCall[1].$set.lastKnownGood).toBe('v2');
    });
  });

  describe('updateNanoBananaVersion', () => {
    it('should update to new version after health check', async () => {
      const mockObjectId = { toString: () => 'nanobanana-version-id' };
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'nanobanana',
          currentVersion: '2.0.0',
          lastKnownGood: '2.0.0',
          availableVersions: ['2.0.0'],
          lastChecked: new Date(),
        }),
        findOneAndUpdate: vi.fn().mockResolvedValueOnce({
          _id: mockObjectId,
          service: 'nanobanana',
          currentVersion: '2.1.0',
          lastKnownGood: '2.1.0',
          availableVersions: ['2.0.0', '2.1.0'],
          lastChecked: new Date(),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.1.0',
        releaseDate: '2026-01-10',
        features: [],
      });

      const result = await manager.updateNanoBananaVersion('2.1.0');

      expect(result.success).toBe(true);
      expect(result.version).toBe('2.1.0');
    });

    it('should rollback on health check failure', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          service: 'nanobanana',
          currentVersion: '2.0.0',
          lastKnownGood: '2.0.0',
          availableVersions: ['2.0.0'],
          lastChecked: new Date(),
        }),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi
        .fn()
        .mockRejectedValueOnce(new Error('Health check failed'));

      const result = await manager.updateNanoBananaVersion('2.1.0');

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.version).toBe('2.0.0');
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for all services', async () => {
      const mockVersions = [
        {
          _id: 'v1',
          service: 'gemini' as const,
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date('2026-01-01'),
        },
        {
          _id: 'v2',
          service: 'nanobanana' as const,
          currentVersion: '2.0.0',
          lastKnownGood: '2.0.0',
          availableVersions: ['2.0.0'],
          lastChecked: new Date('2026-01-02'),
        },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValueOnce(mockVersions),
          }),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;

      const history = await manager.getVersionHistory();

      expect(history).toHaveLength(2);
      expect(history[0].service).toBe('gemini');
      expect(history[1].service).toBe('nanobanana');
    });

    it('should return empty array when no version history exists', async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;

      const history = await manager.getVersionHistory();

      expect(history).toEqual([]);
    });
  });

  describe('autoUpdateAll', () => {
    it('should check and update all services', async () => {
      const mockGeminiVersion = {
        _id: 'gemini-123',
        service: 'gemini' as const,
        currentVersion: 'v1beta',
        lastKnownGood: 'v1beta',
        availableVersions: ['v1beta'],
        lastChecked: new Date(),
      };

      const mockNanoBananaVersion = {
        _id: 'nanobanana-456',
        service: 'nanobanana' as const,
        currentVersion: '2.0.0',
        lastKnownGood: '2.0.0',
        availableVersions: ['2.0.0'],
        lastChecked: new Date(),
      };

      const mockCollection = {
        findOne: vi
          .fn()
          .mockResolvedValueOnce(mockGeminiVersion)
          .mockResolvedValueOnce(mockGeminiVersion)
          .mockResolvedValueOnce(mockNanoBananaVersion)
          .mockResolvedValueOnce(mockNanoBananaVersion),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockGeminiClient.listModels = vi.fn().mockResolvedValueOnce([
        {
          name: 'models/gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Text model',
          inputTokenLimit: 30720,
          outputTokenLimit: 2048,
          supportedGenerationMethods: ['generateContent'],
        },
      ]);
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.0.0',
        releaseDate: '2026-01-01',
        features: [],
      });

      const results = await manager.autoUpdateAll();

      expect(results).toHaveProperty('gemini');
      expect(results).toHaveProperty('nanobanana');
      expect(results.gemini.checked).toBe(true);
      expect(results.nanobanana.checked).toBe(true);
    });

    it('should handle partial failures in auto-update', async () => {
      const mockNanoBananaVersion = {
        _id: 'nanobanana-456',
        service: 'nanobanana' as const,
        currentVersion: '2.0.0',
        lastKnownGood: '2.0.0',
        availableVersions: ['2.0.0'],
        lastChecked: new Date(),
      };

      let callCount = 0;
      const mockCollection = {
        findOne: vi.fn().mockImplementation((_query) => {
          callCount++;
          if (callCount <= 1) {
            throw new Error('Database error');
          }
          return Promise.resolve(mockNanoBananaVersion);
        }),
        findOneAndUpdate: vi.fn(),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;
      mockNanoBananaClient.checkVersion = vi.fn().mockResolvedValueOnce({
        version: '2.0.0',
        releaseDate: '2026-01-01',
        features: [],
      });

      const results = await manager.autoUpdateAll();

      expect(results.gemini.checked).toBe(false);
      expect(results.gemini.error).toBeDefined();
      expect(results.nanobanana.checked).toBe(true);
    });
  });

  describe('getCurrentVersions', () => {
    it('should return current versions for all services', async () => {
      const mockVersions = [
        {
          _id: 'gemini-123',
          service: 'gemini' as const,
          currentVersion: 'v1beta',
          lastKnownGood: 'v1beta',
          availableVersions: ['v1beta'],
          lastChecked: new Date(),
        },
        {
          _id: 'nanobanana-456',
          service: 'nanobanana' as const,
          currentVersion: '2.1.0',
          lastKnownGood: '2.0.0',
          availableVersions: ['2.0.0', '2.1.0'],
          lastChecked: new Date(),
        },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValueOnce(mockVersions),
          }),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;

      const versions = await manager.getCurrentVersions();

      expect(versions).toEqual({
        gemini: 'v1beta',
        nanobanana: '2.1.0',
      });
    });

    it('should return null for services without version data', async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;

      const versions = await manager.getCurrentVersions();

      expect(versions).toEqual({
        gemini: null,
        nanobanana: null,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle database connection failures', async () => {
      mockDb.collection = vi.fn().mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      await expect(manager.checkGeminiVersion()).rejects.toThrow();
    });

    it('should handle invalid version format', async () => {
      await expect(manager.updateGeminiVersion('')).rejects.toThrow('Version is required');
    });

    it('should prevent downgrade to older version', async () => {
      const mockCollection = {
        findOne: vi.fn().mockResolvedValueOnce({
          service: 'gemini',
          currentVersion: 'v2',
          lastKnownGood: 'v2',
          availableVersions: ['v1beta', 'v2'],
          lastChecked: new Date(),
        }),
      };

      // Ensure collection() always returns the same mock instance
      const collectionSpy = vi.fn().mockReturnValue(mockCollection);
      mockDb.collection = collectionSpy;

      await expect(manager.updateGeminiVersion('v1beta')).rejects.toThrow('Cannot downgrade');
    });
  });
});
