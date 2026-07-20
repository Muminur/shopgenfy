import { NextRequest, NextResponse } from 'next/server';
import { imageStore } from '@/lib/image-store';

/**
 * Lists stored image metadata, optionally filtered to one submission. Used
 * by the preview page to hydrate the gallery from `/api/images?submissionId=`.
 */
export async function GET(request: NextRequest) {
  const submissionId = request.nextUrl.searchParams.get('submissionId') ?? undefined;
  const images = imageStore.list(submissionId);

  return NextResponse.json({ images });
}
