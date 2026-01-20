import { NextResponse } from 'next/server';
import { getDatabaseConnected } from '@/lib/mongodb';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: 'connected' | 'disconnected';
    api: 'operational' | 'degraded';
  };
  checks?: {
    [key: string]: boolean;
  };
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const version = process.env.npm_package_version || '1.0.0';
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
  let isHealthy = true;

  // Check database connection
  try {
    const db = await getDatabaseConnected();
    await db.command({ ping: 1 });
    databaseStatus = 'connected';
  } catch (error) {
    console.error('[Health Check] Database connection failed:', error);
    isHealthy = false;
  }

  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    version,
    environment,
    uptime,
    services: {
      database: databaseStatus,
      api: 'operational',
    },
  };

  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
