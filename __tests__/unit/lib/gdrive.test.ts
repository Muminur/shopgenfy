import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GoogleDriveClient,
  createGoogleDriveClient,
  GoogleDriveError,
  type DriveFile,
  type UploadOptions,
  type FolderOptions,
} from '@/lib/gdrive';

describe('GoogleDriveClient', () => {
  const mockCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
  };
  let client: GoogleDriveClient;

  beforeEach(() => {
    client = createGoogleDriveClient(mockCredentials);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createGoogleDriveClient', () => {
    it('should create a client with valid credentials', () => {
      const client = createGoogleDriveClient(mockCredentials);
      expect(client).toBeDefined();
      expect(client.uploadFile).toBeDefined();
      expect(client.createFolder).toBeDefined();
      expect(client.getFileUrl).toBeDefined();
      expect(client.downloadFile).toBeDefined();
    });

    it('should throw error for missing client ID', () => {
      expect(() =>
        createGoogleDriveClient({
          ...mockCredentials,
          clientId: '',
        })
      ).toThrow(GoogleDriveError);
      expect(() =>
        createGoogleDriveClient({
          ...mockCredentials,
          clientId: '',
        })
      ).toThrow('Client ID is required');
    });

    it('should throw error for missing client secret', () => {
      expect(() =>
        createGoogleDriveClient({
          ...mockCredentials,
          clientSecret: '',
        })
      ).toThrow(GoogleDriveError);
    });

    it('should throw error for missing refresh token', () => {
      expect(() =>
        createGoogleDriveClient({
          ...mockCredentials,
          refreshToken: '',
        })
      ).toThrow(GoogleDriveError);
    });
  });

  describe('uploadFile', () => {
    it('should upload a file from URL', async () => {
      const mockFile: DriveFile = {
        id: 'file-123',
        name: 'icon.png',
        mimeType: 'image/png',
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
        webContentLink: 'https://drive.google.com/uc?id=file-123',
        size: 1024,
        createdTime: '2025-01-01T00:00:00Z',
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-access-token',
                expires_in: 3600,
              }),
          });
        }
        if (url.includes('cdn.example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
            headers: { get: () => 'image/png' },
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFile),
        });
      });

      const options: UploadOptions = {
        sourceUrl: 'https://cdn.example.com/icon.png',
        fileName: 'icon.png',
        folderId: 'folder-123',
      };

      const result = await client.uploadFile(options);

      expect(result.id).toBe('file-123');
      expect(result.name).toBe('icon.png');
      expect(result.webViewLink).toContain('drive.google.com');
    });

    it('should upload a file from buffer', async () => {
      const mockFile: DriveFile = {
        id: 'file-456',
        name: 'feature.png',
        mimeType: 'image/png',
        webViewLink: 'https://drive.google.com/file/d/file-456/view',
        webContentLink: 'https://drive.google.com/uc?id=file-456',
        size: 2048,
        createdTime: '2025-01-01T00:00:00Z',
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFile),
        });

      const options: UploadOptions = {
        buffer: Buffer.from('fake image data'),
        fileName: 'feature.png',
        mimeType: 'image/png',
        folderId: 'folder-123',
      };

      const result = await client.uploadFile(options);

      expect(result.id).toBe('file-456');
      expect(result.mimeType).toBe('image/png');
    });

    it('should handle upload errors', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-access-token',
                expires_in: 3600,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: { message: 'Quota exceeded' },
            }),
        });
      });

      const options: UploadOptions = {
        buffer: Buffer.from('data'),
        fileName: 'test.png',
        mimeType: 'image/png',
      };

      try {
        await client.uploadFile(options);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
        expect((error as Error).message).toContain('Quota exceeded');
      }
    });

    it('should validate file name', async () => {
      const options: UploadOptions = {
        buffer: Buffer.from('data'),
        fileName: '',
        mimeType: 'image/png',
      };

      try {
        await client.uploadFile(options);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
        expect((error as Error).message).toContain('File name is required');
      }
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const mockFolder: DriveFile = {
        id: 'folder-789',
        name: 'AppSubmission',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: 'https://drive.google.com/drive/folders/folder-789',
        createdTime: '2025-01-01T00:00:00Z',
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFolder),
        });

      const options: FolderOptions = {
        name: 'AppSubmission',
        parentId: 'root-folder',
      };

      const result = await client.createFolder(options);

      expect(result.id).toBe('folder-789');
      expect(result.mimeType).toBe('application/vnd.google-apps.folder');
    });

    it('should handle duplicate folder names', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              files: [
                {
                  id: 'existing-folder',
                  name: 'AppSubmission',
                  mimeType: 'application/vnd.google-apps.folder',
                  webViewLink: 'https://drive.google.com/drive/folders/existing-folder',
                  createdTime: '2024-12-01T00:00:00Z',
                },
              ],
            }),
        });

      const options: FolderOptions = {
        name: 'AppSubmission',
        parentId: 'root-folder',
        useExisting: true,
      };

      const result = await client.createFolder(options);

      expect(result.id).toBe('existing-folder');
    });
  });

  describe('getFileUrl', () => {
    it('should return shareable URL for a file', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'file-123',
              webViewLink: 'https://drive.google.com/file/d/file-123/view',
              webContentLink: 'https://drive.google.com/uc?id=file-123',
            }),
        });

      const url = await client.getFileUrl('file-123');

      expect(url).toContain('drive.google.com');
      expect(url).toContain('file-123');
    });

    it('should set sharing permissions if requested', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'permission-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'file-123',
              webViewLink: 'https://drive.google.com/file/d/file-123/view',
            }),
        });

      const url = await client.getFileUrl('file-123', { makePublic: true });

      expect(url).toContain('file-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('permissions'),
        expect.any(Object)
      );
    });
  });

  describe('downloadFile', () => {
    it('should download file as buffer', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockData.buffer),
        });

      const result = await client.downloadFile('file-123');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(4);
    });

    it('should handle download errors', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-access-token',
                expires_in: 3600,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: { message: 'File not found' } }),
        });
      });

      try {
        await client.downloadFile('invalid-id');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
        expect((error as Error).message).toContain('File not found');
      }
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      await expect(client.deleteFile('file-123')).resolves.not.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list files in a folder', async () => {
      const mockFiles: DriveFile[] = [
        {
          id: 'file-1',
          name: 'icon.png',
          mimeType: 'image/png',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
          size: 1024,
          createdTime: '2025-01-01T00:00:00Z',
        },
        {
          id: 'file-2',
          name: 'feature.png',
          mimeType: 'image/png',
          webViewLink: 'https://drive.google.com/file/d/file-2/view',
          size: 2048,
          createdTime: '2025-01-01T00:00:00Z',
        },
      ];

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: mockFiles }),
        });

      const files = await client.listFiles('folder-123');

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('icon.png');
    });
  });

  describe('token refresh', () => {
    it('should refresh access token when expired', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'first-token',
              expires_in: 0,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'second-token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] }),
        });

      await client.listFiles('folder-1');
      await client.listFiles('folder-2');

      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should handle token refresh failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      try {
        await client.listFiles('folder-1');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
        expect((error as Error).message).toContain('Failed to refresh access token');
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        await client.listFiles('folder-1');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
      }
    });

    it('should include error details in exception', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'token',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: {
                code: 403,
                message: 'Access denied',
                errors: [{ reason: 'forbidden' }],
              },
            }),
        });

      try {
        await client.listFiles('folder-1');
      } catch (error) {
        expect(error).toBeInstanceOf(GoogleDriveError);
        expect((error as GoogleDriveError).statusCode).toBe(403);
      }
    });
  });
});
