import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  createSubmission,
  getSubmissionById,
  getSubmissionsByUserId,
  updateSubmission,
  deleteSubmission,
  updateSubmissionStatus,
} from '@/lib/db/submissions';
import { COLLECTIONS } from '@/lib/db/collections';

describe('Submissions CRUD Operations', () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  const validSubmissionData = {
    appName: 'MyBrand App',
    appIntroduction: 'A helpful tagline',
    appDescription: 'This app helps merchants with their stores.',
    featureList: ['Feature one', 'Feature two'],
    languages: ['en'],
    worksWith: ['Shopify POS'],
    primaryCategory: 'Store design' as const,
    featureTags: ['productivity'],
    pricing: { type: 'free' as const },
    landingPageUrl: 'https://example.com',
  };

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
    await db.collection(COLLECTIONS.SUBMISSIONS).deleteMany({});
  });

  describe('createSubmission', () => {
    it('should create a new submission with generated id and timestamps', async () => {
      const userId = 'user123';
      const submission = await createSubmission(db, userId, validSubmissionData);

      expect(submission._id).toBeDefined();
      expect(submission.userId).toBe(userId);
      expect(submission.appName).toBe(validSubmissionData.appName);
      expect(submission.status).toBe('draft');
      expect(submission.createdAt).toBeInstanceOf(Date);
      expect(submission.updatedAt).toBeInstanceOf(Date);
    });

    it('should store submission in database', async () => {
      const submission = await createSubmission(db, 'user123', validSubmissionData);
      const found = await db.collection(COLLECTIONS.SUBMISSIONS).findOne({ _id: submission._id });

      expect(found).not.toBeNull();
      expect(found?.appName).toBe(validSubmissionData.appName);
    });

    it('should throw error for invalid data', async () => {
      const invalidData = {
        ...validSubmissionData,
        appName: '', // Empty app name should fail
      };

      await expect(createSubmission(db, 'user123', invalidData)).rejects.toThrow();
    });
  });

  describe('getSubmissionById', () => {
    it('should return submission when found', async () => {
      const created = await createSubmission(db, 'user123', validSubmissionData);
      const found = await getSubmissionById(db, created._id.toString());

      expect(found).not.toBeNull();
      expect(found?._id.toString()).toBe(created._id.toString());
      expect(found?.appName).toBe(validSubmissionData.appName);
    });

    it('should return null for non-existent id', async () => {
      const found = await getSubmissionById(db, new ObjectId().toString());
      expect(found).toBeNull();
    });

    it('should return null for invalid id format', async () => {
      const found = await getSubmissionById(db, 'invalid-id');
      expect(found).toBeNull();
    });
  });

  describe('getSubmissionsByUserId', () => {
    it('should return submissions for user', async () => {
      const userId = 'user123';
      await createSubmission(db, userId, validSubmissionData);
      await createSubmission(db, userId, { ...validSubmissionData, appName: 'Second App' });
      await createSubmission(db, 'otherUser', validSubmissionData);

      const { submissions, total } = await getSubmissionsByUserId(db, userId);

      expect(submissions).toHaveLength(2);
      expect(total).toBe(2);
    });

    it('should support pagination', async () => {
      const userId = 'user123';
      for (let i = 0; i < 5; i++) {
        await createSubmission(db, userId, {
          ...validSubmissionData,
          appName: `App ${i}`,
        });
      }

      const page1 = await getSubmissionsByUserId(db, userId, { page: 1, limit: 2 });
      const page2 = await getSubmissionsByUserId(db, userId, { page: 2, limit: 2 });

      expect(page1.submissions).toHaveLength(2);
      expect(page2.submissions).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it('should return empty array for user with no submissions', async () => {
      const { submissions, total } = await getSubmissionsByUserId(db, 'nonexistent');
      expect(submissions).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  describe('updateSubmission', () => {
    it('should update submission fields', async () => {
      const created = await createSubmission(db, 'user123', validSubmissionData);
      const updated = await updateSubmission(db, created._id.toString(), {
        appName: 'Updated Name',
      });

      expect(updated?.appName).toBe('Updated Name');
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should return null for non-existent id', async () => {
      const updated = await updateSubmission(db, new ObjectId().toString(), {
        appName: 'Test',
      });
      expect(updated).toBeNull();
    });

    it('should return null for invalid id format', async () => {
      const updated = await updateSubmission(db, 'invalid-id', { appName: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('deleteSubmission', () => {
    it('should delete submission and return true', async () => {
      const created = await createSubmission(db, 'user123', validSubmissionData);
      const deleted = await deleteSubmission(db, created._id.toString());

      expect(deleted).toBe(true);

      const found = await getSubmissionById(db, created._id.toString());
      expect(found).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const deleted = await deleteSubmission(db, new ObjectId().toString());
      expect(deleted).toBe(false);
    });

    it('should return false for invalid id format', async () => {
      const deleted = await deleteSubmission(db, 'invalid-id');
      expect(deleted).toBe(false);
    });
  });

  describe('updateSubmissionStatus', () => {
    it('should update status to complete', async () => {
      const created = await createSubmission(db, 'user123', validSubmissionData);
      const updated = await updateSubmissionStatus(db, created._id.toString(), 'complete');

      expect(updated?.status).toBe('complete');
    });

    it('should update status to exported', async () => {
      const created = await createSubmission(db, 'user123', validSubmissionData);
      const updated = await updateSubmissionStatus(db, created._id.toString(), 'exported');

      expect(updated?.status).toBe('exported');
    });
  });
});
