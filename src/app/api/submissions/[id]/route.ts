import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConnected } from '@/lib/mongodb';
import { getSubmissionById, updateSubmission, deleteSubmission } from '@/lib/db/submissions';
import { updateSubmissionSchema } from '@/lib/validators/submission';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = await getDatabaseConnected();
    const submission = await getSubmissionById(db, id);

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Check ownership
    if (submission.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error('Failed to fetch submission:', error);
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate the update data
  const parseResult = updateSubmissionSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 400 });
  }

  try {
    const db = await getDatabaseConnected();

    // Check if submission exists and belongs to user
    const existing = await getSubmissionById(db, id);

    if (!existing) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await updateSubmission(db, id, parseResult.data);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Validation')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Failed to update submission:', error);
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = await getDatabaseConnected();

    // Check if submission exists and belongs to user
    const existing = await getSubmissionById(db, id);

    if (!existing) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteSubmission(db, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete submission:', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
