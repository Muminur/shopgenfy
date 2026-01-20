import { NextResponse } from 'next/server';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Pollinations.ai is a free API that requires no authentication
const POLLINATIONS_API_BASE = 'https://image.pollinations.ai';

interface APIStatus {
  connected: boolean;
  latency?: number;
  error?: string;
}

interface StatusResponse {
  gemini: APIStatus;
  pollinations: APIStatus;
}

async function checkGeminiStatus(): Promise<APIStatus> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { connected: false, error: 'API key not configured' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models`, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return { connected: true, latency };
    }

    return {
      connected: false,
      latency,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      connected: false,
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkPollinationsStatus(): Promise<APIStatus> {
  // Pollinations.ai is a free, no-auth API - we just need to verify it's reachable
  const startTime = Date.now();

  try {
    // Make a minimal request to check if Pollinations is responding
    // We use a small test prompt to verify the service is working
    const testPrompt = encodeURIComponent('test');
    const response = await fetch(
      `${POLLINATIONS_API_BASE}/prompt/${testPrompt}?width=64&height=64&nologo=true`,
      {
        method: 'HEAD', // HEAD request to minimize data transfer
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    const latency = Date.now() - startTime;

    // Pollinations returns 200 for valid requests
    if (response.ok || response.status === 200) {
      return { connected: true, latency };
    }

    return {
      connected: false,
      latency,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      connected: false,
      latency,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function GET() {
  try {
    // Check both APIs in parallel for efficiency
    const [geminiStatus, pollinationsStatus] = await Promise.all([
      checkGeminiStatus(),
      checkPollinationsStatus(),
    ]);

    const response: StatusResponse = {
      gemini: geminiStatus,
      pollinations: pollinationsStatus,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to check API status:', error);
    return NextResponse.json(
      {
        gemini: { connected: false, error: 'Health check failed' },
        pollinations: { connected: false, error: 'Health check failed' },
      },
      { status: 500 }
    );
  }
}
