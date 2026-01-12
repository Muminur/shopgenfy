import { NextResponse } from 'next/server';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const NANOBANANA_API_BASE = 'https://api.nanobanana.io/v1';

interface APIStatus {
  connected: boolean;
  latency?: number;
  error?: string;
}

interface StatusResponse {
  gemini: APIStatus;
  nanobanana: APIStatus;
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

async function checkNanoBananaStatus(): Promise<APIStatus> {
  const apiKey = process.env.NANO_BANANA_API_KEY;

  if (!apiKey) {
    return { connected: false, error: 'API key not configured' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${NANOBANANA_API_BASE}/version`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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

export async function GET() {
  try {
    // Check both APIs in parallel for efficiency
    const [geminiStatus, nanoBananaStatus] = await Promise.all([
      checkGeminiStatus(),
      checkNanoBananaStatus(),
    ]);

    const response: StatusResponse = {
      gemini: geminiStatus,
      nanobanana: nanoBananaStatus,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to check API status:', error);
    return NextResponse.json(
      {
        gemini: { connected: false, error: 'Health check failed' },
        nanobanana: { connected: false, error: 'Health check failed' },
      },
      { status: 500 }
    );
  }
}
