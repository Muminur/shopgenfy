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
import { Download, Edit, ExternalLink, Check, Globe, ImageIcon } from 'lucide-react';

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

function PreviewContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load submission data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!submissionId) {
        setError('No submission ID provided');
        setIsLoading(false);
        return;
      }

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
    };

    loadData();
  }, [submissionId]);

  const handleExport = useCallback(async () => {
    if (!submissionId) return;

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
          <p className="text-muted-foreground mt-2">Review your submission before exporting</p>
        </div>
        <Badge variant={getStatusVariant(submission.status)}>
          {submission.status === 'complete' && <Check className="h-3 w-3 mr-1" />}
          {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
        </Badge>
      </div>

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
                <CardTitle className="text-2xl">{submission.appName}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {submission.appIntroduction}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{submission.appDescription}</p>

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
            <ul className="space-y-2">
              {submission.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
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
                      {iconImage.width}×{iconImage.height}px
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
              <p className="text-muted-foreground text-sm">No images generated yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button asChild variant="outline">
            <Link href={`/dashboard?id=${submissionId}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Submission
            </Link>
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Package'}
          </Button>
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
