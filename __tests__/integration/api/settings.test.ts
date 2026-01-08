import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock MongoDB connection
vi.mock('@/lib/mongodb', () => ({
  getDatabase: vi.fn(),
}));

// Mock user database operations
vi.mock('@/lib/db/users', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));

describe('Settings API Routes', () => {
  const mockUserId = 'user-123';

  const mockUserSettings = {
    _id: 'user-123',
    email: 'test@example.com',
    selectedGeminiModel: 'gemini-pro',
    theme: 'light' as const,
    autoSave: true,
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
      const { getUserById } = await import('@/lib/db/users');
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.selectedGeminiModel).toBe('gemini-pro');
      expect(data.theme).toBe('light');
    });

    it('should return 401 when user ID is missing', async () => {
      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      const { getUserById } = await import('@/lib/db/users');
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { GET } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        headers: { 'x-user-id': mockUserId },
      });

      const response = await GET(request);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update user settings', async () => {
      const updatedSettings = {
        ...mockUserSettings,
        selectedGeminiModel: 'gemini-pro-vision',
        theme: 'dark' as const,
      };

      const { getUserById, updateUser } = await import('@/lib/db/users');
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);
      (updateUser as ReturnType<typeof vi.fn>).mockResolvedValue(updatedSettings);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({
          selectedGeminiModel: 'gemini-pro-vision',
          theme: 'dark',
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.selectedGeminiModel).toBe('gemini-pro-vision');
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
      const { getUserById } = await import('@/lib/db/users');
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserSettings);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

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

    it('should return 404 for non-existent user', async () => {
      const { getUserById } = await import('@/lib/db/users');
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getDatabase } = await import('@/lib/mongodb');
      (getDatabase as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { PUT } = await import('@/app/api/settings/route');
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': mockUserId,
        },
        body: JSON.stringify({ theme: 'dark' }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(404);
    });
  });
});
