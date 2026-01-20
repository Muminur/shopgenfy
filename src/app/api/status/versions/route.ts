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
  try {
    const db = await getDatabaseConnected();

    // Fetch version data for Gemini from database
    const geminiVersion = await getAPIVersionByService(db, 'gemini');

    const now = new Date().toISOString();

    // Pollinations.ai is a free API with no versioning endpoint
    // We provide a static version indicator
    const response: VersionInfoResponse = {
      gemini: {
        version: geminiVersion?.currentVersion ?? null,
        lastChecked: geminiVersion?.lastChecked?.toISOString() ?? now,
      },
      pollinations: {
        version: POLLINATIONS_VERSION,
        lastChecked: now,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch version info:', error);

    // Return default response with null versions on error
    const now = new Date().toISOString();
    return NextResponse.json(
      {
        gemini: { version: null, lastChecked: now },
        pollinations: { version: POLLINATIONS_VERSION, lastChecked: now },
      },
      { status: 500 }
    );
  }
}
