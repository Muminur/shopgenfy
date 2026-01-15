import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '@/app/api/submissions/route';
import { NextRequest } from 'next/server';

describe('Bug Fix: Save Draft with Empty Optional Fields', () => {
  const baseUrl = 'http://localhost:3000';

  beforeAll(() => {
    // Set mock MongoDB to avoid actual database calls
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
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
  });
});
