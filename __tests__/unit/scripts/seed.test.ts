import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoClient, Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  seedUsers,
  seedSubmissions,
  seedImages,
  seedAll,
  clearDatabase,
  SEED_DATA,
} from '../../../scripts/seed';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

describe('Seed Scripts', () => {
  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
  }, 30000); // 30s timeout for MongoDB startup

  afterEach(async () => {
    await client.close();
    await mongoServer.stop();
  });

  describe('SEED_DATA', () => {
    it('should have valid test users', () => {
      expect(SEED_DATA.users).toBeDefined();
      expect(SEED_DATA.users.length).toBeGreaterThan(0);
      SEED_DATA.users.forEach((user) => {
        expect(user.email).toMatch(/@/);
        expect(user.selectedGeminiModel).toBeDefined();
        expect(['light', 'dark', 'system']).toContain(user.theme);
      });
    });

    it('should have valid test submissions', () => {
      expect(SEED_DATA.submissions).toBeDefined();
      expect(SEED_DATA.submissions.length).toBeGreaterThan(0);
      SEED_DATA.submissions.forEach((sub) => {
        expect(sub.appName.length).toBeLessThanOrEqual(30);
        expect(sub.appIntroduction.length).toBeLessThanOrEqual(100);
        expect(sub.appDescription.length).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('seedUsers', () => {
    it('should insert users into database', async () => {
      const result = await seedUsers(db);

      expect(result.insertedCount).toBe(SEED_DATA.users.length);

      const users = await db.collection('users').find().toArray();
      expect(users.length).toBe(SEED_DATA.users.length);
    });

    it('should not duplicate users on re-run', async () => {
      await seedUsers(db);
      await seedUsers(db);

      const users = await db.collection('users').find().toArray();
      // Should have same count, not doubled
      expect(users.length).toBe(SEED_DATA.users.length);
    });
  });

  describe('seedSubmissions', () => {
    it('should insert submissions into database', async () => {
      // First seed users to get valid user IDs
      await seedUsers(db);
      const result = await seedSubmissions(db);

      expect(result.insertedCount).toBe(SEED_DATA.submissions.length);

      const submissions = await db.collection('submissions').find().toArray();
      expect(submissions.length).toBe(SEED_DATA.submissions.length);
    });

    it('should associate submissions with users', async () => {
      await seedUsers(db);
      await seedSubmissions(db);

      const submissions = await db.collection('submissions').find().toArray();
      const users = await db.collection('users').find().toArray();

      submissions.forEach((sub) => {
        const userExists = users.some((u) => u._id.toString() === sub.userId.toString());
        expect(userExists).toBe(true);
      });
    });
  });

  describe('seedImages', () => {
    it('should insert images into database', async () => {
      await seedUsers(db);
      await seedSubmissions(db);
      const result = await seedImages(db);

      expect(result.insertedCount).toBeGreaterThan(0);
    });

    it('should associate images with submissions', async () => {
      await seedUsers(db);
      await seedSubmissions(db);
      await seedImages(db);

      const images = await db.collection('generated_images').find().toArray();
      const submissions = await db.collection('submissions').find().toArray();

      images.forEach((img) => {
        const subExists = submissions.some((s) => s._id.toString() === img.submissionId.toString());
        expect(subExists).toBe(true);
      });
    });
  });

  describe('clearDatabase', () => {
    it('should remove all documents from all collections', async () => {
      await seedUsers(db);
      await seedSubmissions(db);
      await seedImages(db);

      await clearDatabase(db);

      const users = await db.collection('users').countDocuments();
      const submissions = await db.collection('submissions').countDocuments();
      const images = await db.collection('generated_images').countDocuments();

      expect(users).toBe(0);
      expect(submissions).toBe(0);
      expect(images).toBe(0);
    });
  });

  describe('seedAll', () => {
    it('should seed all collections in correct order', async () => {
      const result = await seedAll(db);

      expect(result.users).toBeDefined();
      expect(result.submissions).toBeDefined();
      expect(result.images).toBeDefined();

      const users = await db.collection('users').countDocuments();
      const submissions = await db.collection('submissions').countDocuments();
      const images = await db.collection('generated_images').countDocuments();

      expect(users).toBeGreaterThan(0);
      expect(submissions).toBeGreaterThan(0);
      expect(images).toBeGreaterThan(0);
    });

    it('should clear existing data before seeding when clearFirst is true', async () => {
      // Seed twice
      await seedAll(db, { clearFirst: true });
      await seedAll(db, { clearFirst: true });

      // Should have same counts, not doubled
      const users = await db.collection('users').countDocuments();
      expect(users).toBe(SEED_DATA.users.length);
    });
  });
});
