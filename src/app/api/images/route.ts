import { NextRequest, NextResponse } from 'next/server';
import { imageStore } from '@/lib/image-store';

/**
 * Lists stored image metadata for a SINGLE submission. Used by the preview
 * page to hydrate the gallery from `/api/images?submissionId=`.
 *
 * `submissionId` is mandatory: the route must never enumerate the whole store.
 * Without it, any unauthenticated caller could list every user's images (the
 * store carries no per-user key), so a missing/blank id is a 400 rather than a
 * "list everything" response. The lib-level `imageStore.list()` no-arg path is
 * retained for internal/test use only and is deliberately unreachable here.
 */
export async function GET(request: NextRequest) {
  const submissionId = request.nextUrl.searchParams.get('submissionId')?.trim();

  if (!submissionId) {
    return NextResponse.json(
      { error: 'submissionId query parameter is required' },
      { status: 400 }
    );
  }

  const images = imageStore.list(submissionId);

  return NextResponse.json({ images });
}
