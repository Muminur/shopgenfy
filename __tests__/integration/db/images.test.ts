import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createGeneratedImage,
  getImageById,
  getImagesBySubmissionId,
  updateImage,
  deleteImage,
  deleteImagesBySubmissionId,
} from '@/lib/db/images';

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

const validImageInput = {
  submissionId: new ObjectId().toString(),
  type: 'icon' as const,
  driveFileId: 'drive-file-123',
  driveUrl: 'https://drive.google.com/file/d/123',
  width: 1200,
  height: 1200,
  format: 'png' as const,
  generationPrompt: 'App icon for a productivity app',
  featureHighlighted: 'Main app icon',
  altText: 'App icon showing a productivity dashboard',
  version: 1,
};

describe('GeneratedImage Database Operations', () => {
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
    await db.collection('generated_images').deleteMany({});
  });

  describe('createGeneratedImage', () => {
    it('should create a new image record', async () => {
      const result = await createGeneratedImage(db, validImageInput);

      expect(result).toBeDefined();
      expect(result._id).toBeInstanceOf(ObjectId);
      expect(result.submissionId).toBe(validImageInput.submissionId);
      expect(result.type).toBe('icon');
      expect(result.driveFileId).toBe('drive-file-123');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create feature image with correct dimensions', async () => {
      const featureInput = {
        ...validImageInput,
        type: 'feature' as const,
        width: 1600,
        height: 900,
        featureHighlighted: 'Dashboard analytics',
      };

      const result = await createGeneratedImage(db, featureInput);

      expect(result.type).toBe('feature');
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
      expect(result.featureHighlighted).toBe('Dashboard analytics');
    });

    it('should store the image in the database', async () => {
      const result = await createGeneratedImage(db, validImageInput);

      const stored = await db.collection('generated_images').findOne({ _id: result._id });
      expect(stored).toBeDefined();
      expect(stored?.driveFileId).toBe('drive-file-123');
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date();
      const result = await createGeneratedImage(db, validImageInput);
      const after = new Date();

      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should allow multiple images for the same submission', async () => {
      await createGeneratedImage(db, validImageInput);
      await createGeneratedImage(db, {
        ...validImageInput,
        type: 'feature' as const,
        width: 1600,
        height: 900,
      });

      const count = await db.collection('generated_images').countDocuments({
        submissionId: validImageInput.submissionId,
      });
      expect(count).toBe(2);
    });
  });

  describe('getImageById', () => {
    it('should retrieve an image by id', async () => {
      const created = await createGeneratedImage(db, validImageInput);
      const result = await getImageById(db, created._id.toString());

      expect(result).toBeDefined();
      expect(result?._id.toString()).toBe(created._id.toString());
      expect(result?.driveFileId).toBe('drive-file-123');
    });

    it('should return null for non-existent id', async () => {
      const result = await getImageById(db, new ObjectId().toString());
      expect(result).toBeNull();
    });

    it('should return null for invalid id format', async () => {
      const result = await getImageById(db, 'invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('getImagesBySubmissionId', () => {
    it('should retrieve all images for a submission', async () => {
      const submissionId = new ObjectId().toString();
      await createGeneratedImage(db, { ...validImageInput, submissionId });
      await createGeneratedImage(db, {
        ...validImageInput,
        submissionId,
        type: 'feature' as const,
        width: 1600,
        height: 900,
      });

      const results = await getImagesBySubmissionId(db, submissionId);

      expect(results).toHaveLength(2);
      expect(results.every((img) => img.submissionId === submissionId)).toBe(true);
    });

    it('should return empty array for submission with no images', async () => {
      const results = await getImagesBySubmissionId(db, new ObjectId().toString());
      expect(results).toEqual([]);
    });

    it('should filter by image type', async () => {
      const submissionId = new ObjectId().toString();
      await createGeneratedImage(db, { ...validImageInput, submissionId });
      await createGeneratedImage(db, {
        ...validImageInput,
        submissionId,
        type: 'feature' as const,
        width: 1600,
        height: 900,
      });
      await createGeneratedImage(db, {
        ...validImageInput,
        submissionId,
        type: 'feature' as const,
        width: 1600,
        height: 900,
      });

      const iconResults = await getImagesBySubmissionId(db, submissionId, { type: 'icon' });
      const featureResults = await getImagesBySubmissionId(db, submissionId, { type: 'feature' });

      expect(iconResults).toHaveLength(1);
      expect(featureResults).toHaveLength(2);
    });

    it('should sort by createdAt descending by default', async () => {
      const submissionId = new ObjectId().toString();
      await createGeneratedImage(db, { ...validImageInput, submissionId, version: 1 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createGeneratedImage(db, { ...validImageInput, submissionId, version: 2 });

      const results = await getImagesBySubmissionId(db, submissionId);

      expect(results[0].version).toBe(2);
      expect(results[1].version).toBe(1);
    });
  });

  describe('updateImage', () => {
    it('should update image fields', async () => {
      const created = await createGeneratedImage(db, validImageInput);

      const result = await updateImage(db, created._id.toString(), {
        altText: 'Updated alt text',
        version: 2,
      });

      expect(result).toBeDefined();
      expect(result?.altText).toBe('Updated alt text');
      expect(result?.version).toBe(2);
    });

    it('should preserve unchanged fields', async () => {
      const created = await createGeneratedImage(db, validImageInput);

      const result = await updateImage(db, created._id.toString(), {
        altText: 'Updated alt text',
      });

      expect(result?.driveFileId).toBe('drive-file-123');
      expect(result?.width).toBe(1200);
    });

    it('should return null for non-existent image', async () => {
      const result = await updateImage(db, new ObjectId().toString(), {
        altText: 'Updated',
      });

      expect(result).toBeNull();
    });

    it('should update driveUrl when regenerated', async () => {
      const created = await createGeneratedImage(db, validImageInput);

      const result = await updateImage(db, created._id.toString(), {
        driveUrl: 'https://drive.google.com/file/d/new-456',
        driveFileId: 'drive-file-456',
        version: 2,
      });

      expect(result?.driveUrl).toBe('https://drive.google.com/file/d/new-456');
      expect(result?.driveFileId).toBe('drive-file-456');
      expect(result?.version).toBe(2);
    });
  });

  describe('deleteImage', () => {
    it('should delete an image by id', async () => {
      const created = await createGeneratedImage(db, validImageInput);

      const result = await deleteImage(db, created._id.toString());

      expect(result).toBe(true);

      const stored = await db.collection('generated_images').findOne({ _id: created._id });
      expect(stored).toBeNull();
    });

    it('should return false for non-existent image', async () => {
      const result = await deleteImage(db, new ObjectId().toString());
      expect(result).toBe(false);
    });

    it('should return false for invalid id', async () => {
      const result = await deleteImage(db, 'invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteImagesBySubmissionId', () => {
    it('should delete all images for a submission', async () => {
      const submissionId = new ObjectId().toString();
      await createGeneratedImage(db, { ...validImageInput, submissionId });
      await createGeneratedImage(db, {
        ...validImageInput,
        submissionId,
        type: 'feature' as const,
        width: 1600,
        height: 900,
      });

      const result = await deleteImagesBySubmissionId(db, submissionId);

      expect(result).toBe(2);

      const remaining = await db.collection('generated_images').countDocuments({ submissionId });
      expect(remaining).toBe(0);
    });

    it('should return 0 for submission with no images', async () => {
      const result = await deleteImagesBySubmissionId(db, new ObjectId().toString());
      expect(result).toBe(0);
    });

    it('should not delete images from other submissions', async () => {
      const submissionId1 = new ObjectId().toString();
      const submissionId2 = new ObjectId().toString();

      await createGeneratedImage(db, { ...validImageInput, submissionId: submissionId1 });
      await createGeneratedImage(db, { ...validImageInput, submissionId: submissionId2 });

      await deleteImagesBySubmissionId(db, submissionId1);

      const remaining = await db
        .collection('generated_images')
        .countDocuments({ submissionId: submissionId2 });
      expect(remaining).toBe(1);
    });
  });
});
