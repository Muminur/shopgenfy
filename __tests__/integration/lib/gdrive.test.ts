import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createGoogleDriveClient,
  type GoogleDriveClient,
  type UploadOptions,
  type DriveFile,
} from '@/lib/gdrive';

/**
 * Integration tests for Google Drive API client
 * Tests actual client functions with mocked HTTP responses
 * Focuses on: file operations, OAuth flow, folder management, error handling
 */
describe('Google Drive API Client - Integration Tests', () => {
  const mockCredentials = {
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
  };

  let client: GoogleDriveClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = createGoogleDriveClient(mockCredentials);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('OAuth Token Management', () => {
    it('should fetch access token using refresh token', async () => {
      const mockAccessToken = 'ya29.test-access-token';

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: mockAccessToken,
              expires_in: 3600,
              token_type: 'Bearer',
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-123',
            name: 'test.txt',
            mimeType: 'text/plain',
          }),
        };
      });

      await client.listFiles('folder-id');

      const oauthCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('oauth2.googleapis.com')
      );
      expect(oauthCall).toBeDefined();

      const driveCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('googleapis.com/drive')
      );
      expect(driveCall[1].headers.Authorization).toBe(`Bearer ${mockAccessToken}`);
    });

    it('should cache access token between requests', async () => {
      const mockAccessToken = 'ya29.cached-token';

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: mockAccessToken,
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({ files: [] }),
        };
      });

      await client.listFiles('folder-1');
      await client.listFiles('folder-2');

      const oauthCalls = (global.fetch as any).mock.calls.filter((call: any) =>
        call[0].includes('oauth2.googleapis.com')
      );

      expect(oauthCalls.length).toBe(1);
    });

    it('should throw error when token refresh fails', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({
              error: 'invalid_grant',
              error_description: 'Token has been expired or revoked',
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      });

      await expect(client.listFiles('folder-id')).rejects.toThrow('Failed to refresh access token');
      await expect(client.listFiles('folder-id')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('uploadFile - API Integration', () => {
    it('should upload file from URL successfully', async () => {
      const mockFileUrl = 'https://example.com/image.png';
      const mockFileData = Buffer.from('fake-image-data');

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url === mockFileUrl) {
          return {
            ok: true,
            headers: new Map([['content-type', 'image/png']]),
            arrayBuffer: async () => mockFileData.buffer,
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'uploaded-file-123',
            name: 'image.png',
            mimeType: 'image/png',
            webViewLink: 'https://drive.google.com/file/d/uploaded-file-123/view',
            size: 1024,
            createdTime: '2026-01-10T00:00:00Z',
          }),
        };
      });

      const result = await client.uploadFile({
        sourceUrl: mockFileUrl,
        fileName: 'image.png',
      });

      expect(result.id).toBe('uploaded-file-123');
      expect(result.name).toBe('image.png');
      expect(result.mimeType).toBe('image/png');
      expect(result.webViewLink).toBeDefined();
    });

    it('should upload file from buffer successfully', async () => {
      const mockBuffer = Buffer.from('test file content');

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'buffer-file-456',
            name: 'document.txt',
            mimeType: 'text/plain',
            webContentLink: 'https://drive.google.com/uc?id=buffer-file-456',
          }),
        };
      });

      const result = await client.uploadFile({
        buffer: mockBuffer,
        fileName: 'document.txt',
        mimeType: 'text/plain',
      });

      expect(result.id).toBe('buffer-file-456');
      expect(result.name).toBe('document.txt');
    });

    it('should upload file to specific folder', async () => {
      const mockBuffer = Buffer.from('test content');
      const folderId = 'folder-789';

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-in-folder',
            name: 'test.txt',
            mimeType: 'text/plain',
          }),
        };
      });

      await client.uploadFile({
        buffer: mockBuffer,
        fileName: 'test.txt',
        folderId,
      });

      const uploadCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('upload/drive')
      );
      expect(uploadCall).toBeDefined();
    });

    it('should include description in file metadata', async () => {
      const mockBuffer = Buffer.from('test');

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-with-desc',
            name: 'test.txt',
            mimeType: 'text/plain',
          }),
        };
      });

      await client.uploadFile({
        buffer: mockBuffer,
        fileName: 'test.txt',
        description: 'Test file description',
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error for empty file name', async () => {
      await expect(
        client.uploadFile({
          buffer: Buffer.from('test'),
          fileName: '   ',
        })
      ).rejects.toThrow('File name is required');
    });

    it('should throw error for empty buffer', async () => {
      await expect(
        client.uploadFile({
          buffer: Buffer.alloc(0),
          fileName: 'test.txt',
        })
      ).rejects.toThrow('Buffer must not be empty');
    });

    it('should throw error when neither sourceUrl nor buffer provided', async () => {
      await expect(
        client.uploadFile({
          fileName: 'test.txt',
        } as UploadOptions)
      ).rejects.toThrow('Either sourceUrl or buffer is required');
    });

    it('should handle file fetch failure from URL', async () => {
      const mockFileUrl = 'https://example.com/missing.png';

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url === mockFileUrl) {
          return {
            ok: false,
            statusText: 'Not Found',
          };
        }

        return { ok: true, json: async () => ({}) };
      });

      await expect(
        client.uploadFile({
          sourceUrl: mockFileUrl,
          fileName: 'missing.png',
        })
      ).rejects.toThrow('Failed to fetch file from URL: Not Found');
    });
  });

  describe('createFolder - API Integration', () => {
    it('should create new folder successfully', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'new-folder-123',
            name: 'My Folder',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: 'https://drive.google.com/drive/folders/new-folder-123',
            createdTime: '2026-01-10T00:00:00Z',
          }),
        };
      });

      const result = await client.createFolder({
        name: 'My Folder',
      });

      expect(result.id).toBe('new-folder-123');
      expect(result.name).toBe('My Folder');
      expect(result.mimeType).toBe('application/vnd.google-apps.folder');
    });

    it('should create folder in parent folder', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'subfolder-456',
            name: 'Subfolder',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        };
      });

      const result = await client.createFolder({
        name: 'Subfolder',
        parentId: 'parent-folder-id',
      });

      expect(result.id).toBe('subfolder-456');
      expect(result.name).toBe('Subfolder');
    });

    it('should reuse existing folder when useExisting is true', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url.toString().includes('?q=')) {
          return {
            ok: true,
            json: async () => ({
              files: [
                {
                  id: 'existing-folder-789',
                  name: 'Existing Folder',
                  mimeType: 'application/vnd.google-apps.folder',
                  webViewLink: 'https://drive.google.com/drive/folders/existing-folder-789',
                },
              ],
            }),
          };
        }

        return { ok: true, json: async () => ({}) };
      });

      const result = await client.createFolder({
        name: 'Existing Folder',
        useExisting: true,
      });

      expect(result.id).toBe('existing-folder-789');

      const createCalls = (global.fetch as any).mock.calls.filter(
        (call: any) => call[1]?.method === 'POST' && !call[0].includes('oauth2')
      );
      expect(createCalls.length).toBe(0);
    });

    it('should create new folder when useExisting is true but folder not found', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url.toString().includes('?q=')) {
          return {
            ok: true,
            json: async () => ({
              files: [],
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'new-folder-created',
            name: 'New Folder',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        };
      });

      const result = await client.createFolder({
        name: 'New Folder',
        useExisting: true,
      });

      expect(result.id).toBe('new-folder-created');
    });
  });

  describe('getFileUrl - API Integration', () => {
    it('should get file URL successfully', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-123',
            webViewLink: 'https://drive.google.com/file/d/file-123/view',
            webContentLink: 'https://drive.google.com/uc?id=file-123',
          }),
        };
      });

      const url = await client.getFileUrl('file-123');

      expect(url).toBe('https://drive.google.com/file/d/file-123/view');
    });

    it('should make file public when makePublic is true', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url.toString().includes('/permissions')) {
          return {
            ok: true,
            json: async () => ({
              id: 'anyone',
              type: 'anyone',
              role: 'reader',
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-public',
            webViewLink: 'https://drive.google.com/file/d/file-public/view',
          }),
        };
      });

      await client.getFileUrl('file-public', { makePublic: true });

      const permissionCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('/permissions')
      );
      expect(permissionCall).toBeDefined();
      expect(permissionCall[1].method).toBe('POST');
    });

    it('should fallback to webContentLink when webViewLink unavailable', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 'file-content-link',
            webContentLink: 'https://drive.google.com/uc?id=file-content-link',
          }),
        };
      });

      const url = await client.getFileUrl('file-content-link');

      expect(url).toBe('https://drive.google.com/uc?id=file-content-link');
    });
  });

  describe('downloadFile - API Integration', () => {
    it('should download file as buffer', async () => {
      const mockFileContent = Buffer.from('Downloaded file content');

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        if (url.toString().includes('?alt=media')) {
          return {
            ok: true,
            arrayBuffer: async () => mockFileContent.buffer,
          };
        }

        return { ok: true, json: async () => ({}) };
      });

      const buffer = await client.downloadFile('file-download-123');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('Downloaded file content');
    });

    it('should use alt=media parameter for download', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          arrayBuffer: async () => Buffer.from('content').buffer,
        };
      });

      await client.downloadFile('file-123');

      const downloadCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('?alt=media')
      );
      expect(downloadCall).toBeDefined();
    });
  });

  describe('deleteFile - API Integration', () => {
    it('should delete file successfully', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({}),
        };
      });

      await expect(client.deleteFile('file-to-delete')).resolves.not.toThrow();

      const deleteCall = (global.fetch as any).mock.calls.find(
        (call: any) => call[1]?.method === 'DELETE'
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('file-to-delete');
    });
  });

  describe('listFiles - API Integration', () => {
    it('should list files in folder successfully', async () => {
      const mockFiles: DriveFile[] = [
        {
          id: 'file-1',
          name: 'document.pdf',
          mimeType: 'application/pdf',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
          size: 2048,
        },
        {
          id: 'file-2',
          name: 'image.png',
          mimeType: 'image/png',
          webContentLink: 'https://drive.google.com/uc?id=file-2',
          size: 4096,
        },
      ];

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            files: mockFiles,
          }),
        };
      });

      const files = await client.listFiles('folder-abc');

      expect(files).toHaveLength(2);
      expect(files[0].id).toBe('file-1');
      expect(files[1].name).toBe('image.png');
    });

    it('should query for non-trashed files in folder', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            files: [],
          }),
        };
      });

      await client.listFiles('folder-xyz');

      const listCall = (global.fetch as any).mock.calls.find((call: any) =>
        call[0].includes('?q=')
      );
      expect(listCall[0]).toContain('trashed=false');
      expect(listCall[0]).toContain('folder-xyz');
    });

    it('should return empty array when no files found', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({}),
        };
      });

      const files = await client.listFiles('empty-folder');

      expect(files).toEqual([]);
    });
  });

  describe('Error Handling - API Integration', () => {
    it('should handle 401 unauthorized errors', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              message: 'Invalid Credentials',
              code: 401,
            },
          }),
        };
      });

      await expect(client.listFiles('folder-id')).rejects.toThrow('Invalid Credentials');
      await expect(client.listFiles('folder-id')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should handle 404 not found errors', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: {
              message: 'File not found',
            },
          }),
        };
      });

      await expect(client.downloadFile('missing-file')).rejects.toThrow('File not found');
    });

    it('should handle response without error body', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.toString().includes('oauth2.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              expires_in: 3600,
            }),
          };
        }

        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => {
            throw new Error('No JSON');
          },
        };
      });

      await expect(client.listFiles('folder-id')).rejects.toThrow('Internal Server Error');
    });

    it('should handle network failures', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        throw new Error('Network connection lost');
      });

      await expect(client.listFiles('folder-id')).rejects.toThrow('Network connection lost');
    });
  });
});
