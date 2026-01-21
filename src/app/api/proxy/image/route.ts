import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for downloading images from external sources
 * This avoids CORS issues when downloading images client-side
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Validate URL is from allowed domains
  const allowedHosts = ['image.pollinations.ai', 'pollinations.ai'];
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!allowedHosts.includes(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'URL host not allowed' }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Shopgenfy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
