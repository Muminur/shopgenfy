import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

// Mock MongoDB connection
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
}));

// Mock submissions database operations
vi.mock('@/lib/db/submissions', () => ({
  createSubmission: vi.fn(),
  getSubmissionById: vi.fn(),
  getSubmissionsByUserId: vi.fn(),
  updateSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
}));

describe('Submissions API Routes', () => {
  const mockUserId = 'user-123';
  const mockSubmissionId = new ObjectId().toString();

  const validSubmissionData = {
    appName: 'MyBrand App',
    appIntroduction: 'A helpful tagline',
    appDescription: 'This app helps merchants with their stores.',
    featureList: ['Feature one', 'Feature two'],
    languages: ['en'],
    worksWith: ['Shopify POS'],
    primaryCategory: 'Store design',
    featureTags: ['productivity'],
    pricing: { type: 'free' },
    landingPageUrl: 'https://example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/submissions', () => {
    it('should return list of submissions for user', async () => {
      const mockSubmissions = [
        {
          _id: new ObjectId(),
          userId: mockUserId,
          ...validSubmissionData,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const { getSubmissionsByUserId } = await import('@/lib/db/submissions');
      (getSubmissionsByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
        submissions: mockSubmissions,
        total: 1,
      });

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.submissions).toHaveLength(1);
      expect(data.total).toBe(1);
    });

    it('should support pagination', async () => {
      const { getSubmissionsByUserId } = await import('@/lib/db/submissions');
      (getSubmissionsByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
        submissions: [],
        total: 0,
      });

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions?page=2&limit=10', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getSubmissionsByUserId).toHaveBeenCalledWith(expect.anything(), mockUserId, {
        page: 2,
        limit: 10,
      });
    });

    it('should return 401 when user ID is missing', async () => {
      const { GET } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/submissions', () => {
    it('should create a new submission', async () => {
      const mockCreated = {
        _id: new ObjectId(),
        userId: mockUserId,
        ...validSubmissionData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { createSubmission } = await import('@/lib/db/submissions');
      (createSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreated);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { POST } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify(validSubmissionData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.appName).toBe('MyBrand App');
      expect(data.status).toBe('draft');
    });

    it('should return 400 for invalid submission data', async () => {
      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { POST } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({ appName: '' }), // Invalid: empty app name
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 401 when user ID is missing', async () => {
      const { POST } = await import('@/app/api/submissions/route');
      const request = new NextRequest('http://localhost/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSubmissionData),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/submissions/[id]', () => {
    it('should return a single submission', async () => {
      const mockSubmission = {
        _id: new ObjectId(mockSubmissionId),
        userId: mockUserId,
        ...validSubmissionData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { getSubmissionById } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.appName).toBe('MyBrand App');
    });

    it('should return 404 for non-existent submission', async () => {
      const { getSubmissionById } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(404);
    });

    it('should return 403 for submissions owned by another user', async () => {
      const mockSubmission = {
        _id: new ObjectId(mockSubmissionId),
        userId: 'other-user',
        ...validSubmissionData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { getSubmissionById } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/submissions/[id]', () => {
    it('should update a submission', async () => {
      const mockSubmission = {
        _id: new ObjectId(mockSubmissionId),
        userId: mockUserId,
        ...validSubmissionData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdated = {
        ...mockSubmission,
        appName: 'Updated App Name',
        updatedAt: new Date(),
      };

      const { getSubmissionById, updateSubmission } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);
      (updateSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdated);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({ appName: 'Updated App Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.appName).toBe('Updated App Name');
    });

    it('should return 404 for non-existent submission', async () => {
      const { getSubmissionById } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({ appName: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/submissions/[id]', () => {
    it('should delete a submission', async () => {
      const mockSubmission = {
        _id: new ObjectId(mockSubmissionId),
        userId: mockUserId,
        ...validSubmissionData,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { getSubmissionById, deleteSubmission } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);
      (deleteSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { DELETE } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': mockUserId },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent submission', async () => {
      const { getSubmissionById } = await import('@/lib/db/submissions');
      (getSubmissionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { DELETE } = await import('@/app/api/submissions/[id]/route');
      const request = new NextRequest(`http://localhost/api/submissions/${mockSubmissionId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': mockUserId },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockSubmissionId }) });

      expect(response.status).toBe(404);
    });
  });
});
