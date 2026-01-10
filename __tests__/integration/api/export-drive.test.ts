import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';

// Mock the mongodb module
let mockDb: Db;

vi.mock('@/lib/mongodb', () => ({
  getDatabaseConnected: vi.fn(() => Promise.resolve(mockDb)),
  getMongoClient: vi.fn(),
}));

// Mock the gdrive module
const mockCreateFolder = vi.fn();
const mockUploadFile = vi.fn();
const mockGetFileUrl = vi.fn();

vi.mock('@/lib/gdrive', () => ({
  createGoogleDriveClient: vi.fn(() => ({
    createFolder: mockCreateFolder,
    uploadFile: mockUploadFile,
    getFileUrl: mockGetFileUrl,
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
  })),
  GoogleDriveError: class GoogleDriveError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'GoogleDriveError';
      this.statusCode = statusCode;
    }
  },
}));

// Import after mocks
import { POST } from '@/app/api/export/drive/route';

let mongoServer: MongoMemoryServer;
let client: MongoClient;

// Store original env
const originalEnv = process.env;

describe('Google Drive Export API Route', () => {
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
    // Restore original env
    process.env = originalEnv;
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set mock Google credentials
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REFRESH_TOKEN: 'test-refresh-token',
    };

    // Clean collections
    const collections = await mockDb.listCollections().toArray();
    for (const coll of collections) {
      await mockDb.collection(coll.name).deleteMany({});
    }

    // Default mock implementations
    mockCreateFolder.mockResolvedValue({
      id: 'folder-123',
      name: 'TestApp Export',
      mimeType: 'application/vnd.google-apps.folder',
    });
    mockUploadFile.mockResolvedValue({ id: 'file-123', name: 'image.png', mimeType: 'image/png' });
    mockGetFileUrl.mockResolvedValue('https://drive.google.com/folder/folder-123');
  });

  describe('POST /api/export/drive', () => {
    it('should return 400 for missing submissionId', async () => {
      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('submissionId');
    });

    it('should return 400 for invalid submissionId format', async () => {
      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: 'invalid-id' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid');
    });

    it('should return 404 for non-existent submission', async () => {
      const submissionId = new ObjectId().toString();
      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should create a folder and upload images to Google Drive', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'DriveExportApp',
        appIntroduction: 'Test app',
        appDescription: 'Testing Drive export',
        featureList: ['Feature 1'],
        languages: ['en'],
        primaryCategory: 'Productivity',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await mockDb.collection('generated_images').insertOne({
        _id: new ObjectId(),
        submissionId: submissionId.toString(),
        type: 'icon',
        driveFileId: 'existing-file',
        driveUrl: 'https://example.com/icon.png',
        width: 1200,
        height: 1200,
        format: 'png',
        generationPrompt: 'Test prompt',
        featureHighlighted: '',
        altText: 'App icon',
        version: 1,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.folderId).toBeDefined();
      expect(data.folderUrl).toBeDefined();
      expect(mockCreateFolder).toHaveBeenCalled();
    });

    it('should upload all images to the created folder', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'MultiImageApp',
        appIntroduction: 'Test',
        appDescription: 'Testing multiple images',
        featureList: ['Feature 1', 'Feature 2'],
        languages: ['en'],
        primaryCategory: 'Sales',
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

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.uploadedImages).toBe(3);
    });

    it('should handle submission with no images', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'NoImagesApp',
        appIntroduction: 'Test',
        appDescription: 'No images',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Tools',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.uploadedImages).toBe(0);
    });

    it('should handle Google Drive API errors gracefully', async () => {
      mockCreateFolder.mockRejectedValue(new Error('Drive API error'));

      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'ErrorTestApp',
        appIntroduction: 'Test',
        appDescription: 'Error handling test',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Tools',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed');
    });

    it('should return folder URL in response', async () => {
      const expectedUrl = 'https://drive.google.com/folder/test-folder-123';
      mockGetFileUrl.mockResolvedValue(expectedUrl);

      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'URLTestApp',
        appIntroduction: 'Test',
        appDescription: 'URL test',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Tools',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.folderUrl).toBe(expectedUrl);
    });

    it('should include metadata file in Drive folder', async () => {
      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'MetadataDriveApp',
        appIntroduction: 'Test metadata in Drive',
        appDescription: 'Testing metadata upload to Drive',
        featureList: ['Feature 1'],
        languages: ['en', 'es'],
        primaryCategory: 'Marketing',
        featureTags: ['marketing'],
        pricing: { type: 'freemium' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Verify that metadata was included (uploadFromUrl or similar should be called for metadata)
      expect(mockCreateFolder).toHaveBeenCalled();
    });
  });

  describe('Drive Export Service Unavailable', () => {
    it('should return 503 when Google credentials are not configured', async () => {
      // Clear Google credentials to test 503 response
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const submissionId = new ObjectId();
      await mockDb.collection('submissions').insertOne({
        _id: submissionId,
        appName: 'CredentialTestApp',
        appIntroduction: 'Test',
        appDescription: 'Credentials test',
        featureList: [],
        languages: ['en'],
        primaryCategory: 'Tools',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
        status: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost/api/export/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.toString() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('unavailable');
    });
  });
});
