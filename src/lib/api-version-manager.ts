import type { Db } from 'mongodb';
import type { GeminiClient, GeminiModel } from './gemini';
import type { NanoBananaClient, VersionInfo } from './nanobanana';
import {
  getAPIVersionByService,
  createAPIVersion,
  updateAPIVersion,
  getAllAPIVersions,
  type APIVersionDocument,
} from './db/api-versions';

export class APIVersionManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIVersionManagerError';
  }
}

export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  availableVersions: string[];
  lastChecked: Date;
}

export interface UpdateResult {
  success: boolean;
  version: string;
  previousVersion?: string;
  rolledBack?: boolean;
  error?: string;
}

export interface AutoUpdateResult {
  gemini: {
    checked: boolean;
    hasUpdate?: boolean;
    updated?: boolean;
    version?: string;
    error?: string;
  };
  nanobanana: {
    checked: boolean;
    hasUpdate?: boolean;
    updated?: boolean;
    version?: string;
    error?: string;
  };
}

export interface APIVersionManager {
  checkGeminiVersion(): Promise<VersionCheckResult>;
  checkNanoBananaVersion(): Promise<VersionCheckResult>;
  updateGeminiVersion(newVersion: string): Promise<UpdateResult>;
  updateNanoBananaVersion(newVersion: string): Promise<UpdateResult>;
  getVersionHistory(): Promise<APIVersionDocument[]>;
  autoUpdateAll(): Promise<AutoUpdateResult>;
  getCurrentVersions(): Promise<{ gemini: string | null; nanobanana: string | null }>;
}

function extractGeminiVersion(models: GeminiModel[]): string {
  if (!models || models.length === 0) {
    return 'v1beta';
  }

  const versionPattern = /v(\d+(?:beta)?)/i;
  const versions = new Set<string>();

  for (const model of models) {
    const match = model.name.match(versionPattern);
    if (match) {
      versions.add(match[0]);
    }
  }

  if (versions.size === 0) {
    return 'v1beta';
  }

  const versionArray = Array.from(versions).sort((a, b) => {
    const aNum = parseInt(a.replace(/\D/g, ''), 10) || 1;
    const bNum = parseInt(b.replace(/\D/g, ''), 10) || 1;
    return bNum - aNum;
  });

  return versionArray[0];
}

function compareVersions(current: string, latest: string): boolean {
  const currentNum = parseInt(current.replace(/\D/g, ''), 10) || 1;
  const latestNum = parseInt(latest.replace(/\D/g, ''), 10) || 1;
  return latestNum > currentNum;
}

export function createAPIVersionManager(
  db: Db,
  geminiClient: GeminiClient,
  nanoBananaClient: NanoBananaClient
): APIVersionManager {
  async function checkGeminiVersion(): Promise<VersionCheckResult> {
    try {
      const storedVersion = await getAPIVersionByService(db, 'gemini');

      let models: GeminiModel[];
      try {
        models = await geminiClient.listModels({ filter: 'generateContent' });
      } catch (error) {
        throw new APIVersionManagerError(
          `Failed to check Gemini version: ${(error as Error).message}`
        );
      }

      const latestVersion = extractGeminiVersion(models);
      const availableVersions = Array.from(
        new Set(models.map((m) => extractGeminiVersion([m])))
      ).filter((v) => v);

      if (!storedVersion) {
        await createAPIVersion(db, {
          service: 'gemini',
          currentVersion: latestVersion,
          lastKnownGood: latestVersion,
          availableVersions,
        });

        return {
          hasUpdate: false,
          currentVersion: latestVersion,
          latestVersion,
          availableVersions,
          lastChecked: new Date(),
        };
      }

      const hasUpdate = compareVersions(storedVersion.currentVersion, latestVersion);

      await updateAPIVersion(db, storedVersion._id.toString(), {
        availableVersions,
      });

      return {
        hasUpdate,
        currentVersion: storedVersion.currentVersion,
        latestVersion,
        availableVersions,
        lastChecked: new Date(),
      };
    } catch (error) {
      if (error instanceof APIVersionManagerError) {
        throw error;
      }
      throw new APIVersionManagerError(
        `Failed to check Gemini version: ${(error as Error).message}`
      );
    }
  }

  async function checkNanoBananaVersion(): Promise<VersionCheckResult> {
    try {
      const storedVersion = await getAPIVersionByService(db, 'nanobanana');

      let versionInfo: VersionInfo;
      try {
        versionInfo = await nanoBananaClient.checkVersion();
      } catch (error) {
        throw new APIVersionManagerError(
          `Failed to check Nano Banana version: ${(error as Error).message}`
        );
      }

      const latestVersion = versionInfo.version;

      if (!storedVersion) {
        await createAPIVersion(db, {
          service: 'nanobanana',
          currentVersion: latestVersion,
          lastKnownGood: latestVersion,
          availableVersions: [latestVersion],
        });

        return {
          hasUpdate: false,
          currentVersion: latestVersion,
          latestVersion,
          availableVersions: [latestVersion],
          lastChecked: new Date(),
        };
      }

      const hasUpdate = storedVersion.currentVersion !== latestVersion;

      const availableVersions = Array.from(
        new Set([...storedVersion.availableVersions, latestVersion])
      );

      if (storedVersion._id) {
        await updateAPIVersion(db, storedVersion._id.toString(), {
          availableVersions,
        });
      }

      return {
        hasUpdate,
        currentVersion: storedVersion.currentVersion,
        latestVersion,
        availableVersions,
        lastChecked: new Date(),
      };
    } catch (error) {
      if (error instanceof APIVersionManagerError) {
        throw error;
      }
      throw new APIVersionManagerError(
        `Failed to check Nano Banana version: ${(error as Error).message}`
      );
    }
  }

  async function updateGeminiVersion(newVersion: string): Promise<UpdateResult> {
    if (!newVersion || newVersion.trim() === '') {
      throw new APIVersionManagerError('Version is required');
    }

    try {
      const storedVersion = await getAPIVersionByService(db, 'gemini');

      if (!storedVersion) {
        throw new APIVersionManagerError(
          'No Gemini version record found. Run checkGeminiVersion first.'
        );
      }

      if (compareVersions(newVersion, storedVersion.currentVersion)) {
        throw new APIVersionManagerError(
          `Cannot downgrade from ${storedVersion.currentVersion} to ${newVersion}`
        );
      }

      const previousVersion = storedVersion.currentVersion;

      try {
        await geminiClient.generateContent('Health check', {
          model: 'gemini-pro',
          temperature: 0.1,
          maxOutputTokens: 10,
        });
      } catch (error) {
        return {
          success: false,
          version: storedVersion.lastKnownGood,
          previousVersion,
          rolledBack: true,
          error: `Health check failed: ${(error as Error).message}`,
        };
      }

      const availableVersions = Array.from(
        new Set([...storedVersion.availableVersions, newVersion])
      );

      if (storedVersion._id) {
        await updateAPIVersion(db, storedVersion._id.toString(), {
          currentVersion: newVersion,
          lastKnownGood: newVersion,
          availableVersions,
        });
      }

      return {
        success: true,
        version: newVersion,
        previousVersion,
      };
    } catch (error) {
      if (error instanceof APIVersionManagerError) {
        throw error;
      }
      throw new APIVersionManagerError(
        `Failed to update Gemini version: ${(error as Error).message}`
      );
    }
  }

  async function updateNanoBananaVersion(newVersion: string): Promise<UpdateResult> {
    if (!newVersion || newVersion.trim() === '') {
      throw new APIVersionManagerError('Version is required');
    }

    try {
      const storedVersion = await getAPIVersionByService(db, 'nanobanana');

      if (!storedVersion) {
        throw new APIVersionManagerError(
          'No Nano Banana version record found. Run checkNanoBananaVersion first.'
        );
      }

      const previousVersion = storedVersion.currentVersion;

      try {
        await nanoBananaClient.checkVersion();
      } catch (error) {
        return {
          success: false,
          version: storedVersion.lastKnownGood,
          previousVersion,
          rolledBack: true,
          error: `Health check failed: ${(error as Error).message}`,
        };
      }

      const availableVersions = Array.from(
        new Set([...storedVersion.availableVersions, newVersion])
      );

      if (storedVersion._id) {
        await updateAPIVersion(db, storedVersion._id.toString(), {
          currentVersion: newVersion,
          lastKnownGood: newVersion,
          availableVersions,
        });
      }

      return {
        success: true,
        version: newVersion,
        previousVersion,
      };
    } catch (error) {
      if (error instanceof APIVersionManagerError) {
        throw error;
      }
      throw new APIVersionManagerError(
        `Failed to update Nano Banana version: ${(error as Error).message}`
      );
    }
  }

  async function getVersionHistory(): Promise<APIVersionDocument[]> {
    try {
      return await getAllAPIVersions(db);
    } catch (error) {
      throw new APIVersionManagerError(
        `Failed to get version history: ${(error as Error).message}`
      );
    }
  }

  async function autoUpdateAll(): Promise<AutoUpdateResult> {
    const result: AutoUpdateResult = {
      gemini: { checked: false },
      nanobanana: { checked: false },
    };

    try {
      const geminiCheck = await checkGeminiVersion();
      result.gemini = {
        checked: true,
        hasUpdate: geminiCheck.hasUpdate,
        version: geminiCheck.currentVersion,
      };

      if (geminiCheck.hasUpdate) {
        const updateResult = await updateGeminiVersion(geminiCheck.latestVersion);
        result.gemini.updated = updateResult.success;
        result.gemini.version = updateResult.version;
        if (!updateResult.success) {
          result.gemini.error = updateResult.error;
        }
      }
    } catch (error) {
      result.gemini = {
        checked: false,
        error: (error as Error).message,
      };
    }

    try {
      const nanoBananaCheck = await checkNanoBananaVersion();
      result.nanobanana = {
        checked: true,
        hasUpdate: nanoBananaCheck.hasUpdate,
        version: nanoBananaCheck.currentVersion,
      };

      if (nanoBananaCheck.hasUpdate) {
        const updateResult = await updateNanoBananaVersion(nanoBananaCheck.latestVersion);
        result.nanobanana.updated = updateResult.success;
        result.nanobanana.version = updateResult.version;
        if (!updateResult.success) {
          result.nanobanana.error = updateResult.error;
        }
      }
    } catch (error) {
      result.nanobanana = {
        checked: false,
        error: (error as Error).message,
      };
    }

    return result;
  }

  async function getCurrentVersions(): Promise<{
    gemini: string | null;
    nanobanana: string | null;
  }> {
    try {
      const versions = await getAllAPIVersions(db);

      const result: { gemini: string | null; nanobanana: string | null } = {
        gemini: null,
        nanobanana: null,
      };

      for (const version of versions) {
        if (version.service === 'gemini') {
          result.gemini = version.currentVersion;
        } else if (version.service === 'nanobanana') {
          result.nanobanana = version.currentVersion;
        }
      }

      return result;
    } catch (error) {
      throw new APIVersionManagerError(
        `Failed to get current versions: ${(error as Error).message}`
      );
    }
  }

  return {
    checkGeminiVersion,
    checkNanoBananaVersion,
    updateGeminiVersion,
    updateNanoBananaVersion,
    getVersionHistory,
    autoUpdateAll,
    getCurrentVersions,
  };
}
