import { NextResponse } from 'next/server';
import { getDatabaseConnected } from '@/lib/mongodb';
import { getAPIVersionByService } from '@/lib/db/api-versions';

interface VersionData {
  version: string | null;
  lastChecked: string;
}

interface VersionInfoResponse {
  gemini: VersionData;
  pollinations: VersionData;
}

// Pollinations.ai version - this is a free API, version is tracked from their changelog
const POLLINATIONS_VERSION = '1.0.0';

export async function GET() {
  const now = new Date().toISOString();

  // Start with default values - Pollinations is always available (static version)
  const response: VersionInfoResponse = {
    gemini: {
      version: null,
      lastChecked: now,
    },
    pollinations: {
      version: POLLINATIONS_VERSION,
      lastChecked: now,
    },
  };

  // Try to fetch Gemini version from database (optional - don't fail if DB is down)
  try {
    const db = await getDatabaseConnected();
    const geminiVersion = await getAPIVersionByService(db, 'gemini');

    if (geminiVersion) {
      response.gemini = {
        version: geminiVersion.currentVersion,
        lastChecked: geminiVersion.lastChecked?.toISOString() ?? now,
      };
    }
  } catch (error) {
    // Database unavailable - log but don't fail the request
    console.warn('Could not fetch Gemini version from database:', error);
    // Response already has default values, so we continue
  }

  // Always return 200 - version info is informational, not critical
  return NextResponse.json(response);
}
