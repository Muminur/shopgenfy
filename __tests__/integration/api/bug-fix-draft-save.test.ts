import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

// Mock MongoDB connection
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
  getDatabaseConnected: vi.fn(),
}));

// Mock submissions database operations
vi.mock('@/lib/db/submissions', () => ({
  createSubmission: vi.fn(),
}));

describe('Bug Fix: Save Draft with Empty Optional Fields', () => {
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should accept draft submission with empty primaryCategory', async () => {
    const draftPayload = {
      appName: 'Test App',
      appIntroduction: 'A test application',
      appDescription: 'Testing draft save',
      features: ['Feature 1'], // Dashboard uses 'features'
      languages: [],
      worksWith: [],
      primaryCategory: '', // Empty string should be handled
      secondaryCategory: '',
      featureTags: [],
      pricing: { type: 'free' },
      landingPageUrl: '', // Empty URL in draft mode
      status: 'draft',
    };

    const mockCreated = {
      _id: new ObjectId(),
      userId: 'test-user-123',
      appName: 'Test App',
      appIntroduction: 'A test application',
      appDescription: 'Testing draft save',
      featureList: ['Feature 1'],
      languages: [],
      worksWith: [],
      featureTags: [],
      pricing: { type: 'free' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { createSubmission } = await import('@/lib/db/submissions');
    (createSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreated);

    const { getDatabaseConnected } = await import('@/lib/mongodb');
    (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { POST } = await import('@/app/api/submissions/route');
    const request = new NextRequest(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123',
      },
      body: JSON.stringify(draftPayload),
    });

    const response = await POST(request);

    // Should NOT return 400 for draft with empty optional fields
    expect(response.status).not.toBe(400);
  });

  it('should accept draft submission with minimal required fields only', async () => {
    const minimalDraft = {
      appName: 'Minimal App',
      appIntroduction: '',
      appDescription: '',
      features: [],
      languages: [],
      worksWith: [],
      primaryCategory: '',
      secondaryCategory: '',
      featureTags: [],
      pricing: { type: 'free' },
      landingPageUrl: '',
      status: 'draft',
    };

    const mockCreated = {
      _id: new ObjectId(),
      userId: 'test-user-456',
      appName: 'Minimal App',
      appIntroduction: '',
      appDescription: '',
      featureList: [],
      languages: [],
      worksWith: [],
      featureTags: [],
      pricing: { type: 'free' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { createSubmission } = await import('@/lib/db/submissions');
    (createSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreated);

    const { getDatabaseConnected } = await import('@/lib/mongodb');
    (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { POST } = await import('@/app/api/submissions/route');
    const request = new NextRequest(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-456',
      },
      body: JSON.stringify(minimalDraft),
    });

    const response = await POST(request);

    // Draft should be accepted with just appName
    expect(response.status).not.toBe(400);
  });

  it('should transform dashboard "features" field to "featureList"', async () => {
    const dashboardPayload = {
      appName: 'Feature Test App',
      appIntroduction: 'Testing field transformation',
      appDescription: '',
      features: ['Dashboard Feature 1', 'Dashboard Feature 2'], // Dashboard field name
      languages: [],
      worksWith: [],
      primaryCategory: '',
      secondaryCategory: '',
      featureTags: [],
      pricing: { type: 'free' },
      landingPageUrl: '',
      status: 'draft',
    };

    const mockCreated = {
      _id: new ObjectId(),
      userId: 'test-user-789',
      appName: 'Feature Test App',
      appIntroduction: 'Testing field transformation',
      appDescription: '',
      featureList: ['Dashboard Feature 1', 'Dashboard Feature 2'],
      languages: [],
      worksWith: [],
      featureTags: [],
      pricing: { type: 'free' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { createSubmission } = await import('@/lib/db/submissions');
    (createSubmission as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreated);

    const { getDatabaseConnected } = await import('@/lib/mongodb');
    (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { POST } = await import('@/app/api/submissions/route');
    const request = new NextRequest(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-789',
      },
      body: JSON.stringify(dashboardPayload),
    });

    const response = await POST(request);

    // Should handle features -> featureList transformation
    expect(response.status).not.toBe(400);
    expect(createSubmission).toHaveBeenCalledWith(
      expect.anything(),
      'test-user-789',
      expect.objectContaining({
        featureList: ['Dashboard Feature 1', 'Dashboard Feature 2'],
      })
    );
  });
});
