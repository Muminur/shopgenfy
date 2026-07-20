import { NextRequest, NextResponse } from 'next/server';
import { imageStore } from '@/lib/image-store';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Serves the raw PNG bytes for a previously stored image. Ids are
 * unguessable UUIDs, so this route is intentionally unauthenticated (mirrors
 * a CDN URL) — same rationale as the spec's `/api/images?submissionId=`
 * listing route.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const entry = imageStore.get(id);
  if (!entry) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(entry.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
      'Content-Length': entry.buffer.length.toString(),
    },
  });
}
