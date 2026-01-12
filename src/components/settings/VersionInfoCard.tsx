'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Info, Clock } from 'lucide-react';

export interface VersionData {
  version: string | null;
  lastChecked: string;
}

export interface VersionInfoResponse {
  gemini: VersionData;
  nanobanana: VersionData;
}

interface VersionItemProps {
  name: string;
  version: string | null;
  ariaLabel: string;
}

function VersionItem({ name, version, ariaLabel }: VersionItemProps) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border bg-background"
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{name}</span>
      </div>
      <Badge variant={version ? 'default' : 'secondary'}>{version || 'N/A'}</Badge>
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return 'Unknown';
  }
}

export function VersionInfoCard() {
  const [versionInfo, setVersionInfo] = useState<VersionInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersionInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/status/versions');

      if (!response.ok) {
        throw new Error('Failed to fetch version info');
      }

      const data: VersionInfoResponse = await response.json();
      setVersionInfo(data);
    } catch (err) {
      setError('Failed to load version information');
      console.error('Version info fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersionInfo();
  }, [fetchVersionInfo]);

  const lastChecked = versionInfo?.gemini?.lastChecked || versionInfo?.nanobanana?.lastChecked;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version Info</CardTitle>
        <CardDescription>Current API versions in use</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6" role="status">
            <LoadingSpinner size="sm" text="Loading versions..." />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-muted-foreground">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <VersionItem
                name="Gemini API"
                version={versionInfo?.gemini?.version ?? null}
                ariaLabel="Gemini API version information"
              />
              <VersionItem
                name="Nano Banana API"
                version={versionInfo?.nanobanana?.version ?? null}
                ariaLabel="Nano Banana API version information"
              />
            </div>

            {lastChecked && (
              <div
                className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t"
                data-testid="last-checked-timestamp"
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>Last checked: {formatTimestamp(lastChecked)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
