const GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: number;
  createdTime?: string;
}

export interface UploadOptions {
  sourceUrl?: string;
  buffer?: Buffer;
  fileName: string;
  mimeType?: string;
  folderId?: string;
  description?: string;
}

export interface FolderOptions {
  name: string;
  parentId?: string;
  useExisting?: boolean;
}

export interface FileUrlOptions {
  makePublic?: boolean;
}

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GoogleDriveError';
  }
}

export interface GoogleDriveClient {
  uploadFile(options: UploadOptions): Promise<DriveFile>;
  createFolder(options: FolderOptions): Promise<DriveFile>;
  getFileUrl(fileId: string, options?: FileUrlOptions): Promise<string>;
  downloadFile(fileId: string): Promise<Buffer>;
  deleteFile(fileId: string): Promise<void>;
  listFiles(folderId: string): Promise<DriveFile[]>;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export function createGoogleDriveClient(credentials: DriveCredentials): GoogleDriveClient {
  if (!credentials.clientId || credentials.clientId.trim() === '') {
    throw new GoogleDriveError('Client ID is required');
  }
  if (!credentials.clientSecret || credentials.clientSecret.trim() === '') {
    throw new GoogleDriveError('Client secret is required');
  }
  if (!credentials.refreshToken || credentials.refreshToken.trim() === '') {
    throw new GoogleDriveError('Refresh token is required');
  }

  let tokenCache: TokenCache | null = null;

  async function getAccessToken(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache.accessToken;
    }

    try {
      const response = await fetch(GOOGLE_OAUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new GoogleDriveError('Failed to refresh access token', response.status);
      }

      const data = await response.json();
      tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };

      return tokenCache.accessToken;
    } catch (error) {
      if (error instanceof GoogleDriveError) {
        throw error;
      }
      throw new GoogleDriveError((error as Error).message);
    }
  }

  async function makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await getAccessToken();

    const headers = {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${accessToken}`,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new GoogleDriveError(errorBody?.error?.message || response.statusText, response.status);
    }

    return response;
  }

  async function uploadFile(options: UploadOptions): Promise<DriveFile> {
    if (!options.fileName || options.fileName.trim() === '') {
      throw new GoogleDriveError('File name is required');
    }

    let fileData: ArrayBuffer;
    let mimeType = options.mimeType || 'application/octet-stream';

    if (options.sourceUrl) {
      const fetchResponse = await fetch(options.sourceUrl);
      if (!fetchResponse.ok) {
        throw new GoogleDriveError(`Failed to fetch file from URL: ${fetchResponse.statusText}`);
      }
      fileData = await fetchResponse.arrayBuffer();
      const contentType = fetchResponse.headers.get('content-type');
      if (contentType) {
        mimeType = contentType;
      }
    } else if (options.buffer) {
      if (options.buffer.byteLength === 0) {
        throw new GoogleDriveError('Buffer must not be empty');
      }
      fileData = options.buffer.buffer.slice(
        options.buffer.byteOffset,
        options.buffer.byteOffset + options.buffer.byteLength
      );
    } else {
      throw new GoogleDriveError('Either sourceUrl or buffer is required');
    }

    const metadata: Record<string, unknown> = {
      name: options.fileName,
      mimeType,
    };

    if (options.folderId) {
      metadata.parents = [options.folderId];
    }

    if (options.description) {
      metadata.description = options.description;
    }

    const boundary = 'boundary_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const mediaPart = delimiter + `Content-Type: ${mimeType}\r\n\r\n`;

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart + mediaPart);
    const closeBytes = encoder.encode(closeDelimiter);

    const body = new Uint8Array(metadataBytes.length + fileData.byteLength + closeBytes.length);
    body.set(metadataBytes, 0);
    body.set(new Uint8Array(fileData), metadataBytes.length);
    body.set(closeBytes, metadataBytes.length + fileData.byteLength);

    const response = await makeRequest(
      `${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    return response.json();
  }

  async function createFolder(options: FolderOptions): Promise<DriveFile> {
    if (options.useExisting) {
      const escapedName = options.name.replace(/'/g, "\\'");
      let query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (options.parentId) {
        const escapedParentId = options.parentId.replace(/'/g, "\\'");
        query += ` and '${escapedParentId}' in parents`;
      }

      const searchResponse = await makeRequest(
        `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,createdTime)`,
        { method: 'GET' }
      );

      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0];
      }
    }

    const metadata: Record<string, unknown> = {
      name: options.name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (options.parentId) {
      metadata.parents = [options.parentId];
    }

    const response = await makeRequest(
      `${GOOGLE_DRIVE_API}/files?fields=id,name,mimeType,webViewLink,createdTime`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );

    return response.json();
  }

  async function getFileUrl(fileId: string, options: FileUrlOptions = {}): Promise<string> {
    if (options.makePublic) {
      await makeRequest(`${GOOGLE_DRIVE_API}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    }

    const response = await makeRequest(
      `${GOOGLE_DRIVE_API}/files/${fileId}?fields=id,webViewLink,webContentLink`,
      { method: 'GET' }
    );

    const data = await response.json();
    return data.webViewLink || data.webContentLink;
  }

  async function downloadFile(fileId: string): Promise<Buffer> {
    const response = await makeRequest(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      method: 'GET',
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async function deleteFile(fileId: string): Promise<void> {
    await makeRequest(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async function listFiles(folderId: string): Promise<DriveFile[]> {
    const query = `'${folderId}' in parents and trashed=false`;
    const response = await makeRequest(
      `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime)`,
      { method: 'GET' }
    );

    const data = await response.json();
    return data.files || [];
  }

  return {
    uploadFile,
    createFolder,
    getFileUrl,
    downloadFile,
    deleteFile,
    listFiles,
  };
}
