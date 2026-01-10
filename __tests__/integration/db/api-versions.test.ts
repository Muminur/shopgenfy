import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createAPIVersion,
  getAPIVersionById,
  getAPIVersionByService,
  updateAPIVersion,
  deleteAPIVersion,
  getAllAPIVersions,
} from '@/lib/db/api-versions';
import { ensureIndexes } from '@/lib/db/collections';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

const validGeminiVersionInput = {
  service: 'gemini' as const,
  currentVersion: 'v1.5',
  lastKnownGood: 'v1.5',
  availableVersions: ['v1.0', 'v1.5', 'v2.0-beta'],
};

const validNanoBananaVersionInput = {
  service: 'nanobanana' as const,
  currentVersion: '2.1.0',
  lastKnownGood: '2.0.5',
  availableVersions: ['2.0.0', '2.0.5', '2.1.0'],
};

describe('APIVersion Database Operations', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('api_versions').deleteMany({});
  });

  describe('createAPIVersion', () => {
    it('should create a new API version record', async () => {
      const result = await createAPIVersion(db, validGeminiVersionInput);

      expect(result).toBeDefined();
      expect(result._id).toBeInstanceOf(ObjectId);
      expect(result.service).toBe('gemini');
      expect(result.currentVersion).toBe('v1.5');
      expect(result.lastKnownGood).toBe('v1.5');
      expect(result.availableVersions).toEqual(['v1.0', 'v1.5', 'v2.0-beta']);
      expect(result.lastChecked).toBeInstanceOf(Date);
    });

    it('should create Nano Banana version record', async () => {
      const result = await createAPIVersion(db, validNanoBananaVersionInput);

      expect(result.service).toBe('nanobanana');
      expect(result.currentVersion).toBe('2.1.0');
      expect(result.lastKnownGood).toBe('2.0.5');
    });

    it('should set lastChecked timestamp', async () => {
      const before = new Date();
      const result = await createAPIVersion(db, validGeminiVersionInput);
      const after = new Date();

      expect(result.lastChecked.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastChecked.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should store the version in the database', async () => {
      const result = await createAPIVersion(db, validGeminiVersionInput);

      const stored = await db.collection('api_versions').findOne({ _id: result._id });
      expect(stored).toBeDefined();
      expect(stored?.service).toBe('gemini');
    });

    it('should enforce unique service constraint', async () => {
      await createAPIVersion(db, validGeminiVersionInput);

      await expect(createAPIVersion(db, validGeminiVersionInput)).rejects.toThrow();
    });
  });

  describe('getAPIVersionById', () => {
    it('should retrieve an API version by id', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);
      const result = await getAPIVersionById(db, created._id.toString());

      expect(result).toBeDefined();
      expect(result?._id.toString()).toBe(created._id.toString());
      expect(result?.service).toBe('gemini');
      expect(result?.currentVersion).toBe('v1.5');
    });

    it('should return null for non-existent id', async () => {
      const result = await getAPIVersionById(db, new ObjectId().toString());
      expect(result).toBeNull();
    });

    it('should return null for invalid id format', async () => {
      const result = await getAPIVersionById(db, 'invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('getAPIVersionByService', () => {
    it('should retrieve API version by service name', async () => {
      await createAPIVersion(db, validGeminiVersionInput);
      const result = await getAPIVersionByService(db, 'gemini');

      expect(result).toBeDefined();
      expect(result?.service).toBe('gemini');
      expect(result?.currentVersion).toBe('v1.5');
    });

    it('should return null for non-existent service', async () => {
      const result = await getAPIVersionByService(db, 'gemini');
      expect(result).toBeNull();
    });

    it('should distinguish between different services', async () => {
      await createAPIVersion(db, validGeminiVersionInput);
      await createAPIVersion(db, validNanoBananaVersionInput);

      const geminiResult = await getAPIVersionByService(db, 'gemini');
      const nanoBananaResult = await getAPIVersionByService(db, 'nanobanana');

      expect(geminiResult?.service).toBe('gemini');
      expect(nanoBananaResult?.service).toBe('nanobanana');
    });
  });

  describe('getAllAPIVersions', () => {
    it('should retrieve all API versions', async () => {
      await createAPIVersion(db, validGeminiVersionInput);
      await createAPIVersion(db, validNanoBananaVersionInput);

      const results = await getAllAPIVersions(db);

      expect(results).toHaveLength(2);
      expect(results.map((v) => v.service).sort()).toEqual(['gemini', 'nanobanana']);
    });

    it('should return empty array when no versions exist', async () => {
      const results = await getAllAPIVersions(db);
      expect(results).toEqual([]);
    });

    it('should sort by service name ascending', async () => {
      await createAPIVersion(db, validNanoBananaVersionInput);
      await createAPIVersion(db, validGeminiVersionInput);

      const results = await getAllAPIVersions(db);

      expect(results[0].service).toBe('gemini');
      expect(results[1].service).toBe('nanobanana');
    });
  });

  describe('updateAPIVersion', () => {
    it('should update version fields', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);

      const result = await updateAPIVersion(db, created._id.toString(), {
        currentVersion: 'v2.0',
        availableVersions: ['v1.0', 'v1.5', 'v2.0'],
      });

      expect(result).toBeDefined();
      expect(result?.currentVersion).toBe('v2.0');
      expect(result?.availableVersions).toEqual(['v1.0', 'v1.5', 'v2.0']);
    });

    it('should preserve unchanged fields', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);

      const result = await updateAPIVersion(db, created._id.toString(), {
        currentVersion: 'v2.0',
      });

      expect(result?.service).toBe('gemini');
      expect(result?.lastKnownGood).toBe('v1.5');
    });

    it('should update lastChecked timestamp on any update', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await updateAPIVersion(db, created._id.toString(), {
        currentVersion: 'v2.0',
      });

      expect(result?.lastChecked.getTime()).toBeGreaterThan(created.lastChecked.getTime());
    });

    it('should return null for non-existent version', async () => {
      const result = await updateAPIVersion(db, new ObjectId().toString(), {
        currentVersion: 'v2.0',
      });

      expect(result).toBeNull();
    });

    it('should update lastKnownGood when version is stable', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);

      const result = await updateAPIVersion(db, created._id.toString(), {
        currentVersion: 'v2.0',
        lastKnownGood: 'v2.0',
      });

      expect(result?.currentVersion).toBe('v2.0');
      expect(result?.lastKnownGood).toBe('v2.0');
    });

    it('should handle version rollback scenario', async () => {
      const created = await createAPIVersion(db, {
        ...validGeminiVersionInput,
        currentVersion: 'v2.0-beta',
      });

      const result = await updateAPIVersion(db, created._id.toString(), {
        currentVersion: 'v1.5',
      });

      expect(result?.currentVersion).toBe('v1.5');
      expect(result?.lastKnownGood).toBe('v1.5');
    });
  });

  describe('deleteAPIVersion', () => {
    it('should delete an API version by id', async () => {
      const created = await createAPIVersion(db, validGeminiVersionInput);

      const result = await deleteAPIVersion(db, created._id.toString());

      expect(result).toBe(true);

      const stored = await db.collection('api_versions').findOne({ _id: created._id });
      expect(stored).toBeNull();
    });

    it('should return false for non-existent version', async () => {
      const result = await deleteAPIVersion(db, new ObjectId().toString());
      expect(result).toBe(false);
    });

    it('should return false for invalid id', async () => {
      const result = await deleteAPIVersion(db, 'invalid-id');
      expect(result).toBe(false);
    });
  });
});
