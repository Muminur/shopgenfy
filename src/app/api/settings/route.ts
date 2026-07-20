import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConnected } from '@/lib/mongodb';
import { getOrCreateUser, updateUser } from '@/lib/db/users';

const VALID_THEMES = ['light', 'dark', 'system'] as const;
const VALID_SCREENSHOT_SOURCES = ['website', 'repo', 'folder'] as const;

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDatabaseConnected();
    // Upsert: a well-formed id can never 404 — new users get defaults.
    const user = await getOrCreateUser(db, userId);

    return NextResponse.json({
      selectedGeminiModel: user.selectedGeminiModel,
      theme: user.theme,
      autoSave: user.autoSave,
      screenshotSource: user.screenshotSource,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    // DB unreachable/unconfigured — fail fast so the client can fall back.
    return NextResponse.json({ error: 'Settings service unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    selectedGeminiModel?: string;
    theme?: string;
    autoSave?: boolean;
    screenshotSource?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate theme if provided
  if (body.theme && !VALID_THEMES.includes(body.theme as (typeof VALID_THEMES)[number])) {
    return NextResponse.json(
      { error: 'Invalid theme. Must be "light", "dark", or "system"' },
      { status: 400 }
    );
  }

  // Validate screenshotSource if provided
  if (
    body.screenshotSource &&
    !VALID_SCREENSHOT_SOURCES.includes(
      body.screenshotSource as (typeof VALID_SCREENSHOT_SOURCES)[number]
    )
  ) {
    return NextResponse.json(
      { error: 'Invalid screenshotSource. Must be "website", "repo", or "folder"' },
      { status: 400 }
    );
  }

  try {
    const db = await getDatabaseConnected();

    // Ensure the user exists (upsert) so an update can never 404.
    await getOrCreateUser(db, userId);

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (body.selectedGeminiModel !== undefined) {
      updates.selectedGeminiModel = body.selectedGeminiModel;
    }
    if (body.theme !== undefined) {
      updates.theme = body.theme;
    }
    if (body.autoSave !== undefined) {
      updates.autoSave = body.autoSave;
    }
    if (body.screenshotSource !== undefined) {
      updates.screenshotSource = body.screenshotSource;
    }

    const updated = await updateUser(db, userId, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({
      selectedGeminiModel: updated.selectedGeminiModel,
      theme: updated.theme,
      autoSave: updated.autoSave,
      screenshotSource: updated.screenshotSource,
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Settings service unavailable' }, { status: 503 });
  }
}
