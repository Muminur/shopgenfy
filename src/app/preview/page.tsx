'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MainLayout } from '@/components/layout/MainLayout';
import { AlertMessage } from '@/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Edit, ExternalLink, Check, Globe, ImageIcon, Radio } from 'lucide-react';
import { usePreviewSync, PreviewFormData } from '@/hooks/usePreviewSync';

interface Submission {
  id: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  features: string[];
  landingPageUrl: string;
  status: 'draft' | 'complete' | 'exported';
  createdAt: string;
  updatedAt: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  type: 'icon' | 'feature';
  width: number;
  height: number;
  alt: string;
}

/**
 * Convert PreviewFormData to Submission format for display
 */
function previewDataToSubmission(data: PreviewFormData): Submission {
  return {
    id: 'draft',
    appName: data.appName || 'Untitled App',
    appIntroduction: data.appIntroduction || '',
    appDescription: data.appDescription || '',
    features: data.features.filter((f) => f.trim().length > 0),
    landingPageUrl: data.landingPageUrl || '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Preview sync hook for real-time localStorage synchronization
  const { loadFromPreview, hasPreviewData, enableLivePreview, disableLivePreview, lastSynced } =
    usePreviewSync({
      onDataChange: (data) => {
        // Update submission when data changes from another tab
        if (isLiveMode) {
          setSubmission(previewDataToSubmission(data));
        }
      },
    });

  // Load submission data on mount
  useEffect(() => {
    const loadData = async () => {
      // If we have a submission ID, fetch from API
      if (submissionId) {
        try {
          // Fetch submission
          const submissionRes = await fetch(`/api/submissions/${submissionId}`);
          if (!submissionRes.ok) {
            if (submissionRes.status === 404) {
              setError('Submission not found');
            } else {
              setError('Failed to load submission');
            }
            setIsLoading(false);
            return;
          }
          const submissionData = await submissionRes.json();
          setSubmission(submissionData);

          // Fetch images
          const imagesRes = await fetch(`/api/images?submissionId=${submissionId}`);
          if (imagesRes.ok) {
            const imagesData = await imagesRes.json();
            setImages(imagesData.images || []);
          }
        } catch {
          setError('Failed to load preview data');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // No submission ID - try to load from localStorage (live preview mode)
      if (hasPreviewData()) {
        const previewData = loadFromPreview();
        if (previewData) {
          setSubmission(previewDataToSubmission(previewData));
          setIsLiveMode(true);
          enableLivePreview();
        } else {
          setError('No preview data available');
        }
      } else {
        setError('No submission ID provided and no draft data available');
      }
      setIsLoading(false);
    };

    loadData();
  }, [submissionId, hasPreviewData, loadFromPreview, enableLivePreview]);

  // Cleanup live preview on unmount
  useEffect(() => {
    return () => {
      disableLivePreview();
    };
  }, [disableLivePreview]);

  // Periodically check for updates when in live mode (for same-tab updates)
  useEffect(() => {
    if (!isLiveMode) return;

    const intervalId = setInterval(() => {
      const previewData = loadFromPreview();
      if (previewData) {
        setSubmission(previewDataToSubmission(previewData));
      }
    }, 1000); // Check every second

    return () => clearInterval(intervalId);
  }, [isLiveMode, loadFromPreview]);

  const handleExport = useCallback(async () => {
    if (!submissionId) {
      setError('Cannot export draft preview. Please save your submission first.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/export/${submissionId}`);
      if (!response.ok) {
        throw new Error('Failed to export submission');
      }

      // Download the export package
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${submission?.appName || 'submission'}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export submission. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [submissionId, submission?.appName]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'complete':
        return 'default';
      case 'exported':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Memoize image filtering for performance
  const iconImage = useMemo(() => images.find((img) => img.type === 'icon'), [images]);
  const featureImages = useMemo(() => images.filter((img) => img.type === 'feature'), [images]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Preview</h1>
        </div>
        <AlertMessage
          variant="error"
          message={error || 'Submission not found'}
          onDismiss={() => setError(null)}
        />
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Edit className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Preview</h1>
          <p className="text-muted-foreground mt-2">
            {isLiveMode
              ? 'Live preview - changes sync automatically'
              : 'Review your submission before exporting'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live Preview Indicator */}
          {isLiveMode && (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 border-green-500 text-green-600"
              aria-label="Live Preview Mode Active"
            >
              <Radio className="h-3 w-3 animate-pulse" />
              Live Preview
            </Badge>
          )}
          <Badge variant={getStatusVariant(submission.status)}>
            {submission.status === 'complete' && <Check className="h-3 w-3 mr-1" />}
            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Live Preview Sync Status */}
      {isLiveMode && lastSynced && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-700 dark:text-green-400 flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Live sync active - editing in dashboard will update this preview
              </span>
              <span className="text-green-600 dark:text-green-500">
                Last update: {lastSynced.toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* App Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              {iconImage && (
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border">
                  <Image src={iconImage.url} alt={iconImage.alt} fill className="object-cover" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {submission.appName || (
                    <span className="text-muted-foreground italic">App Name</span>
                  )}
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  {submission.appIntroduction || (
                    <span className="italic">Add a tagline in the dashboard</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {submission.appDescription || (
                <span className="italic">Add a description in the dashboard</span>
              )}
            </p>

            {submission.landingPageUrl && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a
                  href={submission.landingPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  {submission.landingPageUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Key capabilities of your app</CardDescription>
          </CardHeader>
          <CardContent>
            {submission.features.length > 0 ? (
              <ul className="space-y-2">
                {submission.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No features added yet. Add features in the dashboard.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Images Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images
            </CardTitle>
            <CardDescription>Generated images for your listing</CardDescription>
          </CardHeader>
          <CardContent>
            {images.length > 0 ? (
              <div className="space-y-6">
                {/* App Icon */}
                {iconImage && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">App Icon</h4>
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                      <Image
                        src={iconImage.url}
                        alt={iconImage.alt}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {iconImage.width}x{iconImage.height}px
                    </p>
                  </div>
                )}

                {/* Feature Images */}
                {featureImages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Feature Images</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {featureImages.map((image) => (
                        <div
                          key={image.id}
                          className="relative aspect-video rounded-lg overflow-hidden border"
                        >
                          <Image src={image.url} alt={image.alt} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {isLiveMode
                  ? 'No images in live preview. Generate images in the dashboard.'
                  : 'No images generated yet.'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button asChild variant="outline">
            <Link href={submissionId ? `/dashboard?id=${submissionId}` : '/dashboard'}>
              <Edit className="h-4 w-4 mr-2" />
              {isLiveMode ? 'Back to Dashboard' : 'Edit Submission'}
            </Link>
          </Button>
          {!isLiveMode && (
            <Button onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Package'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <MainLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <PreviewContent />
      </Suspense>
    </MainLayout>
  );
}
