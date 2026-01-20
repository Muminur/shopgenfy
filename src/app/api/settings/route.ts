import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConnected } from '@/lib/mongodb';
import { getUserById, updateUser } from '@/lib/db/users';

const VALID_THEMES = ['light', 'dark', 'system'] as const;

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
    const user = await getUserById(db, userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return only settings-related fields
    return NextResponse.json({
      selectedGeminiModel: user.selectedGeminiModel,
      theme: user.theme,
      autoSave: user.autoSave,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
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

  try {
    const db = await getDatabaseConnected();

    // Check if user exists
    const existingUser = await getUserById(db, userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    const updated = await updateUser(db, userId, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    // Return only settings-related fields
    return NextResponse.json({
      selectedGeminiModel: updated.selectedGeminiModel,
      theme: updated.theme,
      autoSave: updated.autoSave,
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
