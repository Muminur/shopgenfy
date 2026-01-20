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
}));

describe('Bug Fix: Dashboard Save Draft', () => {
  const mockUserId = 'user-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/submissions - Dashboard Field Compatibility', () => {
    it('should accept "features" field from dashboard and map to "featureList"', async () => {
      // This is the exact payload sent from dashboard (line 258-261 in page.tsx)
      const dashboardPayload = {
        landingPageUrl: 'https://example.com',
        appName: 'Test App',
        appIntroduction: 'A test app',
        appDescription: 'This is a test app description',
        features: ['Feature 1', 'Feature 2', 'Feature 3'], // Dashboard sends "features"
        languages: ['en'],
        worksWith: ['Shopify POS'],
        primaryCategory: 'Store design',
        secondaryCategory: '',
        pricing: { type: 'free' },
        status: 'draft',
      };

      const mockCreated = {
        _id: new ObjectId(),
        userId: mockUserId,
        appName: 'Test App',
        appIntroduction: 'A test app',
        appDescription: 'This is a test app description',
        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
        languages: ['en'],
        worksWith: ['Shopify POS'],
        primaryCategory: 'Store design',
        secondaryCategory: '',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
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
        body: JSON.stringify(dashboardPayload),
      });

      const response = await POST(request);

      // Should succeed with 201 or return meaningful error with 400
      if (response.status === 400) {
        const error = await response.json();
        console.log('Validation Error:', error);
        expect(error.error).toContain('featureList'); // This will fail and show us the exact error
      }

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.appName).toBe('Test App');
    });

    it('should handle empty features array from dashboard', async () => {
      const dashboardPayload = {
        landingPageUrl: 'https://example.com',
        appName: 'Test App',
        appIntroduction: 'A test app',
        appDescription: 'This is a test description',
        features: [], // Empty features is valid
        languages: ['en'],
        worksWith: [],
        primaryCategory: 'Store design',
        secondaryCategory: '',
        pricing: { type: 'free' },
        status: 'draft',
      };

      const mockCreated = {
        _id: new ObjectId(),
        userId: mockUserId,
        ...dashboardPayload,
        featureList: [],
        featureTags: [],
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
        body: JSON.stringify(dashboardPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should handle missing secondaryCategory from dashboard', async () => {
      const dashboardPayload = {
        landingPageUrl: 'https://example.com',
        appName: 'Test App',
        appIntroduction: 'A test app',
        appDescription: 'This is a test description',
        features: ['Feature 1'],
        languages: ['en'],
        worksWith: [],
        primaryCategory: 'Store design',
        secondaryCategory: '', // Empty string for optional field
        pricing: { type: 'free' },
        status: 'draft',
      };

      const mockCreated = {
        _id: new ObjectId(),
        userId: mockUserId,
        appName: 'Test App',
        appIntroduction: 'A test app',
        appDescription: 'This is a test description',
        featureList: ['Feature 1'],
        languages: ['en'],
        worksWith: [],
        primaryCategory: 'Store design',
        featureTags: [],
        pricing: { type: 'free' },
        landingPageUrl: 'https://example.com',
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
        body: JSON.stringify(dashboardPayload),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});
