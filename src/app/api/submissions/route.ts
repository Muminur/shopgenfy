import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { createSubmission, getSubmissionsByUserId } from '@/lib/db/submissions';
import { createSubmissionSchema } from '@/lib/validators/submission';
import { ZodError } from 'zod';

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

/**
 * Transform dashboard field names to API schema field names
 * Dashboard uses 'features' but API expects 'featureList'
 * Also ensures featureTags exists as empty array if not provided
 * Handles draft mode by making optional fields truly optional
 */
function transformDashboardToApi(body: unknown): unknown {
  // Validate it's an object first
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body; // Let Zod handle the error
  }

  const data = body as Record<string, unknown>;
  const transformed: Record<string, unknown> = { ...data };

  // Map 'features' to 'featureList'
  if ('features' in data && !('featureList' in data)) {
    transformed.featureList = data.features;
    delete transformed.features;
  }

  // Ensure featureTags exists (defaults to empty array)
  if (!('featureTags' in transformed)) {
    transformed.featureTags = [];
  }

  // Helper to check if value should be removed (empty string, null, undefined, or whitespace-only)
  const isEmptyValue = (value: unknown): boolean => {
    return (
      value === '' ||
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    );
  };

  // Handle optional fields - remove if empty to allow draft mode
  const optionalFields = ['secondaryCategory', 'primaryCategory', 'landingPageUrl'];
  optionalFields.forEach((field) => {
    if (field in transformed && isEmptyValue(transformed[field])) {
      delete transformed[field];
    }
  });

  return transformed;
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDatabase();

    // Parse and validate pagination params
    const searchParams = request.nextUrl.searchParams;
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '10';

    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 10)); // Cap at 100

    const result = await getSubmissionsByUserId(db, userId, { page, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch submissions:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Transform dashboard field names to API field names
  const transformedBody = transformDashboardToApi(body);

  // Validate the input
  const parseResult = createSubmissionSchema.safeParse(transformedBody);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const submission = await createSubmission(db, userId, parseResult.data);

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 400 });
    }

    console.error('Failed to create submission:', error);
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
  }
}
