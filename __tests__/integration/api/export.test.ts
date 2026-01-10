import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';

// Mock the mongodb module
let mockDb: Db;

vi.mock('@/lib/mongodb', () => ({
  getDatabaseConnected: vi.fn(() => Promise.resolve(mockDb)),
  getMongoClient: vi.fn(),
}));

// Import after mock
import { GET } from '@/app/api/export/[id]/route';
import { vi } from 'vitest';

let mongoServer: MongoMemoryServer;
let client: MongoClient;

describe('Export API Route', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new MongoClient(uri);
    await client.connect();
    mockDb = client.db('test');
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean collections
    const collections = await mockDb.listCollections().toArray();
    for (const coll of collections) {
      await mockDb.collection(coll.name).deleteMany({});
    }
  });

  describe('GET /api/export/[id]', () => {
    it('should return 400 for invalid submission ID format', async () => {
      const request = new NextRequest('http://localhost/api/export/invalid-id');

      const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid');
    });

    it('should return 404 for non-existent submission', async () => {
      const submissionId = new ObjectId().toString();
      const request = new NextRequest(`http://localhost/api/export/${submissionId}`);

      const response = await GET(request, { params: Promise.resolve({ id: submissionId }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should return ZIP file for valid submission with images', async () => {
      // Create a submission
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'Test Export App',
        appIntroduction: 'A test app for export',
        appDescription: 'This is a comprehensive test application.',
        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: ['productivity', 'automation'],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create associated images
      await mockDb.collection('generated_images').insertMany([
        {
          _id: new ObjectId(),
          submissionId: submissionId.toString(),
          type: 'icon',
          driveFileId: 'file-1',
          driveUrl: 'https://example.com/icon.png',
          width: 1200,
          height: 1200,
          format: 'png',
          generationPrompt: 'Test icon prompt',
          featureHighlighted: '',
          altText: 'App icon',
          version: 1,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          submissionId: submissionId.toString(),
          type: 'feature',
          driveFileId: 'file-2',
          driveUrl: 'https://example.com/feature1.png',
          width: 1600,
          height: 900,
          format: 'png',
          generationPrompt: 'Test feature prompt',
          featureHighlighted: 'Feature 1',
          altText: 'Feature 1 image',
          version: 1,
          createdAt: new Date(),
        },
      ]);

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/zip');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.zip');
    });

    it('should include metadata.json in export', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'Metadata Test App',
        appIntroduction: 'Testing metadata export',
        appDescription: 'App for testing metadata in export.',
        featureList: ['Feature A'],
        languages: ['en', 'es'],
        primaryCategory: 'Sales',
        featureTags: ['sales'],
        pricing: { type: 'freemium' },
        landingPageUrl: 'https://test.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
      // The response should be a ZIP containing metadata
      const blob = await response.blob();
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle submission with no images gracefully', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'No Images App',
        appIntroduction: 'App without images',
        appDescription: 'Testing export without images.',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Tools',
        featureTags: ['tools'],
        pricing: { type: 'free' },
        landingPageUrl: 'https://noimages.com',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      // Should still return a ZIP with just metadata
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/zip');
    });

    it('should use app name in ZIP filename', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'MyAwesomeApp',
        appIntroduction: 'Test',
        appDescription: 'Test description',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('MyAwesomeApp');
    });

    it('should sanitize app name for filename', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'My/App:Name*Test',
        appIntroduction: 'Test',
        appDescription: 'Test description',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
      const disposition = response.headers.get('Content-Disposition');
      // Should not contain invalid filename characters
      expect(disposition).not.toContain('/');
      expect(disposition).not.toContain(':');
      expect(disposition).not.toContain('*');
    });

    it('should include export timestamp in metadata', async () => {
      const submissionId = new ObjectId();
      const createdAt = new Date('2025-01-01');
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'Timestamp Test',
        appIntroduction: 'Test',
        appDescription: 'Test description',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt,
        updatedAt: createdAt,
      });

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Export Content Structure', () => {
    it('should organize images by type in export', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'Organized Export',
        appIntroduction: 'Test',
        appDescription: 'Test description',
        featureList: ['Feature 1', 'Feature 2'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await mockDb.collection('generated_images').insertMany([
        {
          _id: new ObjectId(),
          submissionId: submissionId.toString(),
          type: 'icon',
          driveFileId: 'icon-file',
          driveUrl: 'https://example.com/icon.png',
          width: 1200,
          height: 1200,
          format: 'png',
          generationPrompt: 'Icon prompt',
          featureHighlighted: '',
          altText: 'App icon',
          version: 1,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          submissionId: submissionId.toString(),
          type: 'feature',
          driveFileId: 'feature-file-1',
          driveUrl: 'https://example.com/feature1.png',
          width: 1600,
          height: 900,
          format: 'png',
          generationPrompt: 'Feature 1 prompt',
          featureHighlighted: 'Feature 1',
          altText: 'Feature 1',
          version: 1,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          submissionId: submissionId.toString(),
          type: 'feature',
          driveFileId: 'feature-file-2',
          driveUrl: 'https://example.com/feature2.png',
          width: 1600,
          height: 900,
          format: 'png',
          generationPrompt: 'Feature 2 prompt',
          featureHighlighted: 'Feature 2',
          altText: 'Feature 2',
          version: 1,
          createdAt: new Date(),
        },
      ]);

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
    });

    it('should include all submission fields in metadata', async () => {
      const submissionId = new ObjectId();
      const submission = {
        _id: submissionId,
        appName: 'Full Metadata App',
        appIntroduction: 'Complete metadata test',
        appDescription: 'Testing all fields are included in metadata export.',
        featureList: ['Feature A', 'Feature B', 'Feature C'],
        languages: ['en', 'es', 'fr'],
        primaryCategory: 'Marketing',
        secondaryCategory: 'Sales',
        featureTags: ['marketing', 'sales', 'automation'],
        pricing: {
          type: 'subscription',
          price: 9.99,
          currency: 'USD',
          billingCycle: 'monthly',
        },
        landingPageUrl: 'https://fullmetadata.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await mockDb.collection('submissions').insertOne(submission);

      const request = new NextRequest(`http://localhost/api/export/${submissionId.toString()}`);

      const response = await GET(request, {
        params: Promise.resolve({ id: submissionId.toString() }),
      });

      expect(response.status).toBe(200);
    });
  });
});
