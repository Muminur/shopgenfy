import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  getOrCreateUser,
} from '@/lib/db/users';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

describe('Users Database Operations', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean users collection
    await db.collection('users').deleteMany({});
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'light' as const,
        autoSave: true,
      };

      const user = await createUser(db, userData);

      expect(user).toBeDefined();
      expect(user._id).toBeInstanceOf(ObjectId);
      expect(user.email).toBe(userData.email);
      expect(user.selectedGeminiModel).toBe(userData.selectedGeminiModel);
      expect(user.theme).toBe(userData.theme);
      expect(user.autoSave).toBe(userData.autoSave);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const before = new Date();
      const user = await createUser(db, {
        email: 'timestamp@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'dark',
        autoSave: false,
      });
      const after = new Date();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
    });

    it('should reject invalid email', async () => {
      await expect(
        createUser(db, {
          email: 'invalid-email',
          selectedGeminiModel: 'gemini-pro',
          theme: 'light',
          autoSave: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const created = await createUser(db, {
        email: 'findbyid@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'light',
        autoSave: true,
      });

      const found = await getUserById(db, created._id.toString());

      expect(found).toBeDefined();
      expect(found?._id.toString()).toBe(created._id.toString());
      expect(found?.email).toBe('findbyid@example.com');
    });

    it('should return null for invalid ID', async () => {
      const result = await getUserById(db, 'invalid-id');
      expect(result).toBeNull();
    });

    it('should return null for non-existent ID', async () => {
      const result = await getUserById(db, new ObjectId().toString());
      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const created = await createUser(db, {
        email: 'findbyemail@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'dark',
        autoSave: false,
      });

      const found = await getUserByEmail(db, 'findbyemail@example.com');

      expect(found).toBeDefined();
      expect(found?._id.toString()).toBe(created._id.toString());
      expect(found?.email).toBe('findbyemail@example.com');
    });

    it('should return null for non-existent email', async () => {
      const result = await getUserByEmail(db, 'nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const created = await createUser(db, {
        email: 'update@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'light',
        autoSave: true,
      });

      const updated = await updateUser(db, created._id.toString(), {
        theme: 'dark',
        autoSave: false,
      });

      expect(updated).toBeDefined();
      expect(updated?.theme).toBe('dark');
      expect(updated?.autoSave).toBe(false);
      expect(updated?.email).toBe('update@example.com'); // unchanged
    });

    it('should update updatedAt timestamp', async () => {
      const created = await createUser(db, {
        email: 'updatetime@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'light',
        autoSave: true,
      });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateUser(db, created._id.toString(), {
        theme: 'dark',
      });

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime());
    });

    it('should return null for invalid ID', async () => {
      const result = await updateUser(db, 'invalid-id', { theme: 'dark' });
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const result = await updateUser(db, new ObjectId().toString(), { theme: 'dark' });
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user', async () => {
      const created = await createUser(db, {
        email: 'delete@example.com',
        selectedGeminiModel: 'gemini-pro',
        theme: 'light',
        autoSave: true,
      });

      const result = await deleteUser(db, created._id.toString());
      expect(result).toBe(true);

      // Verify deletion
      const found = await getUserById(db, created._id.toString());
      expect(found).toBeNull();
    });

    it('should return false for invalid ID', async () => {
      const result = await deleteUser(db, 'invalid-id');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await deleteUser(db, new ObjectId().toString());
      expect(result).toBe(false);
    });
  });

  describe('getUserById (string-keyed)', () => {
    it('should return a user document keyed by a client string id', async () => {
      await getOrCreateUser(db, 'user-strkey');

      const found = await getUserById(db, 'user-strkey');

      expect(found).toBeDefined();
      expect(found?._id).toBe('user-strkey');
      expect(found?.selectedGeminiModel).toBe('auto');
    });
  });

  describe('getOrCreateUser (string-keyed upsert)', () => {
    it('should create a new user keyed by the provided string id with defaults', async () => {
      const result = await getOrCreateUser(db, 'user-abc');

      expect(result._id).toBe('user-abc');
      expect(result.selectedGeminiModel).toBe('auto');
      expect(result.theme).toBe('system');
      expect(result.screenshotSource).toBe('website');
      expect(result.autoSave).toBe(true);
    });

    it('should not require an email', async () => {
      const result = await getOrCreateUser(db, 'user-noemail');
      expect(result.email).toBeUndefined();
    });

    it('should be idempotent and not create a duplicate on the second call', async () => {
      const first = await getOrCreateUser(db, 'user-dupe');
      const second = await getOrCreateUser(db, 'user-dupe');

      expect(second._id).toBe(first._id);
      // beforeEach clears the collection, so the only doc is this one.
      const count = await db.collection('users').countDocuments({});
      expect(count).toBe(1);
    });

    it('should preserve existing settings on subsequent calls', async () => {
      await getOrCreateUser(db, 'user-keep');
      await updateUser(db, 'user-keep', {
        theme: 'dark',
        selectedGeminiModel: 'gemini-flash-latest',
      });

      const result = await getOrCreateUser(db, 'user-keep');

      expect(result.theme).toBe('dark');
      expect(result.selectedGeminiModel).toBe('gemini-flash-latest');
    });
  });
});
