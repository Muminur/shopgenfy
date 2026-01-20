'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface APIStatus {
  connected: boolean;
  latency?: number;
  error?: string;
}

export interface APIStatusResponse {
  gemini: APIStatus;
  pollinations: APIStatus;
}

interface StatusIndicatorProps {
  name: string;
  status: APIStatus | null;
  ariaLabel: string;
}

function StatusIndicator({ name, status, ariaLabel }: StatusIndicatorProps) {
  const isConnected = status?.connected ?? false;

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border bg-background"
      aria-label={ariaLabel}
      role="status"
    >
      <div className="flex items-center gap-3">
        {isConnected ? (
          <Wifi className="h-5 w-5 text-green-600" aria-hidden="true" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-600" aria-hidden="true" />
        )}
        <span className="font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn('h-2.5 w-2.5 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')}
          aria-hidden="true"
        />
        <span
          className={cn('text-sm font-medium', isConnected ? 'text-green-600' : 'text-red-600')}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}

export function APIStatusCard() {
  const [status, setStatus] = useState<APIStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/status');

      if (!response.ok) {
        throw new Error('Failed to fetch API status');
      }

      const data: APIStatusResponse = await response.json();
      setStatus(data);
    } catch (err) {
      setError('Failed to check API status');
      console.error('API status check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Status</CardTitle>
        <CardDescription>Connection status for external API services</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6" role="status">
            <LoadingSpinner size="sm" text="Checking connections..." />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-muted-foreground">{error}</div>
        ) : (
          <div className="space-y-3">
            <StatusIndicator
              name="Gemini API"
              status={status?.gemini ?? null}
              ariaLabel="Gemini API connection status"
            />
            <StatusIndicator
              name="Pollinations AI"
              status={status?.pollinations ?? null}
              ariaLabel="Pollinations AI connection status"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
