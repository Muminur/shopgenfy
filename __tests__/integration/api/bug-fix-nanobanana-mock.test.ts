import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/nanobanana/generate/route';
import { NextRequest } from 'next/server';

describe.skip('Bug Fix: Nanobanana Mock Mode for Missing API Key (DEPRECATED - Mock mode removed, using Pollinations.ai)', () => {
  const baseUrl = 'http://localhost:3000';
  let originalApiKey: string | undefined;
  let originalMockMode: string | undefined;

  beforeEach(() => {
    // Save original values
    originalApiKey = process.env.NANO_BANANA_API_KEY;
    originalMockMode = process.env.NANO_BANANA_MOCK_MODE;
  });

  afterEach(() => {
    // Restore original values
    process.env.NANO_BANANA_API_KEY = originalApiKey;
    process.env.NANO_BANANA_MOCK_MODE = originalMockMode;
  });

  it('should return 500 when API key is missing and mock mode is off', async () => {
    // Remove API key
    delete process.env.NANO_BANANA_API_KEY;
    process.env.NANO_BANANA_MOCK_MODE = 'false';

    const payload = {
      type: 'icon',
      prompt: 'Test app icon',
      style: 'modern',
    };

    const request = new NextRequest(`${baseUrl}/api/nanobanana/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('not configured');
  });

  it('should return mock image when API key is missing but mock mode is enabled', async () => {
    // Remove API key but enable mock mode
    delete process.env.NANO_BANANA_API_KEY;
    process.env.NANO_BANANA_MOCK_MODE = 'true';

    const payload = {
      type: 'icon',
      prompt: 'Test app icon for mock generation',
      style: 'modern',
    };

    const request = new NextRequest(`${baseUrl}/api/nanobanana/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    // Should succeed with mock data
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image).toBeDefined();
    expect(data.image.url).toContain('placeholder.com');
    expect(data.image.width).toBe(1200);
    expect(data.image.height).toBe(1200);
  });

  it('should return mock feature image with correct dimensions in mock mode', async () => {
    delete process.env.NANO_BANANA_API_KEY;
    process.env.NANO_BANANA_MOCK_MODE = 'true';

    const payload = {
      type: 'feature',
      prompt: 'Feature showcase image',
      featureHighlight: 'Amazing feature',
      style: 'modern',
    };

    const request = new NextRequest(`${baseUrl}/api/nanobanana/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image).toBeDefined();
    expect(data.image.width).toBe(1600);
    expect(data.image.height).toBe(900);
  });

  it('should use real API when key is present regardless of mock mode', async () => {
    process.env.NANO_BANANA_API_KEY = 'test-api-key-123';
    process.env.NANO_BANANA_MOCK_MODE = 'true';

    const payload = {
      type: 'icon',
      prompt: 'Real API test',
      style: 'modern',
    };

    const request = new NextRequest(`${baseUrl}/api/nanobanana/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);

    // Should use mock mode when explicitly enabled
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image).toBeDefined();
  });
});
