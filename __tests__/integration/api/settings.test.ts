import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock MongoDB connection
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
  getDatabaseConnected: vi.fn(),
}));

// Mock user database operations. Settings now upserts via getOrCreateUser so a
// well-formed user id can never 404.
vi.mock('@/lib/db/users', () => ({
  getOrCreateUser: vi.fn(),
  updateUser: vi.fn(),
}));

describe('Settings API Routes', () => {
  const mockUserId = 'user-123';

  const mockUserSettings = {
    _id: 'user-123',
    selectedGeminiModel: 'gemini-pro',
    theme: 'light' as const,
    autoSave: true,
    screenshotSource: 'website' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/settings', () => {
    it('should return user settings', async () => {
      const { getOrCreateUser } = await import('@/lib/db/users');
      (getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.selectedGeminiModel).toBe('gemini-pro');
      expect(data.theme).toBe('light');
      expect(data.screenshotSource).toBe('website');
    });

    it('should return 401 when user ID is missing', async () => {
      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 200 with defaults for a brand-new user (never 404)', async () => {
      const { getOrCreateUser } = await import('@/lib/db/users');
      (getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        _id: 'user-new',
        selectedGeminiModel: 'auto',
        theme: 'system',
        autoSave: true,
        screenshotSource: 'website',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        headers: { 'x-user-id': 'user-new' },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.selectedGeminiModel).toBe('auto');
      expect(data.theme).toBe('system');
      expect(data.screenshotSource).toBe('website');
    });

    it('should return 503 when the database is unreachable', async () => {
      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('server selection timed out')
      );

      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(503);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update user settings', async () => {
      const updatedSettings = {
        ...mockUserSettings,
        selectedGeminiModel: 'gemini-flash-latest',
        theme: 'dark' as const,
      };

      const { getOrCreateUser, updateUser } = await import('@/lib/db/users');
      (getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);
      (updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedSettings);

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({
          selectedGeminiModel: 'gemini-flash-latest',
          theme: 'dark',
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.selectedGeminiModel).toBe('gemini-flash-latest');
      expect(data.theme).toBe('dark');
    });

    it('should update a brand-new user without 404 (upsert)', async () => {
      const freshUser = {
        _id: 'user-fresh',
        selectedGeminiModel: 'auto',
        theme: 'system' as const,
        autoSave: true,
        screenshotSource: 'website' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { getOrCreateUser, updateUser } = await import('@/lib/db/users');
      (getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue(freshUser);
      (updateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...freshUser,
        theme: 'dark',
      });

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-fresh',
        },
        body: JSON.stringify({ theme: 'dark' }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.theme).toBe('dark');
    });

    it('should return 401 when user ID is missing', async () => {
      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid settings data', async () => {
      const { getOrCreateUser } = await import('@/lib/db/users');
      (getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);

      const { getDatabaseConnected } = await import('@/lib/mongodb');
      (getDatabaseConnected as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({ theme: 'invalid-theme' }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });
  });
});
