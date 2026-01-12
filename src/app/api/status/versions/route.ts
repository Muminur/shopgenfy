import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getAPIVersionByService } from '@/lib/db/api-versions';

interface VersionData {
  version: string | null;
  lastChecked: string;
}

interface VersionInfoResponse {
  gemini: VersionData;
  nanobanana: VersionData;
}

export async function GET() {
  try {
    const db = await getDatabase();

    // Fetch version data for both services in parallel
    const [geminiVersion, nanoBananaVersion] = await Promise.all([
      getAPIVersionByService(db, 'gemini'),
      getAPIVersionByService(db, 'nanobanana'),
    ]);

    const now = new Date().toISOString();

    const response: VersionInfoResponse = {
      gemini: {
        version: geminiVersion?.currentVersion ?? null,
        lastChecked: geminiVersion?.lastChecked?.toISOString() ?? now,
      },
      nanobanana: {
        version: nanoBananaVersion?.currentVersion ?? null,
        lastChecked: nanoBananaVersion?.lastChecked?.toISOString() ?? now,
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
        nanobanana: { version: null, lastChecked: now },
      },
      { status: 500 }
    );
  }
}
