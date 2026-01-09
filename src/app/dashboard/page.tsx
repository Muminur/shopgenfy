'use client';

import { useState, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CharacterCountInput } from '@/components/forms/CharacterCountInput';
import { CharacterCountTextarea } from '@/components/forms/CharacterCountTextarea';
import { URLInput } from '@/components/forms/URLInput';
import { FeatureListEditor } from '@/components/forms/FeatureListEditor';
import { ImageGallery } from '@/components/images/ImageGallery';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { AlertMessage } from '@/components/feedback/AlertMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Download, Save, Globe, ImageIcon, Loader2 } from 'lucide-react';

interface FormData {
  landingPageUrl: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  features: string[];
}

const initialFormData: FormData = {
  landingPageUrl: '',
  appName: '',
  appIntroduction: '',
  appDescription: '',
  features: [''],
};

// Shopify character limits
const LIMITS = {
  appName: 30,
  appIntroduction: 100,
  appDescription: 500,
  featureItem: 80,
  maxFeatures: 10,
};

export default function DashboardPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<
    {
      id: string;
      url: string;
      type: 'icon' | 'feature';
      width: number;
      height: number;
      alt: string;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate completion progress
  const calculateProgress = useCallback(() => {
    let completed = 0;
    const total = 5;

    if (formData.appName.length > 0) completed++;
    if (formData.appIntroduction.length > 0) completed++;
    if (formData.appDescription.length > 0) completed++;
    if (formData.features.filter((f) => f.trim().length > 0).length > 0) completed++;
    if (images.length > 0) completed++;

    return Math.round((completed / total) * 100);
  }, [formData, images]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, landingPageUrl: e.target.value }));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!formData.landingPageUrl) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.landingPageUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze landing page');
      }

      const data = await response.json();

      // Auto-fill form with analyzed data
      setFormData((prev) => ({
        ...prev,
        appName: data.appName || prev.appName,
        appIntroduction: data.appIntroduction || prev.appIntroduction,
        appDescription: data.appDescription || prev.appDescription,
        features: data.features?.length > 0 ? data.features : prev.features,
      }));

      setSuccess('Landing page analyzed successfully!');
    } catch {
      setError('Failed to analyze landing page. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [formData.landingPageUrl]);

  const handleGenerateImages = useCallback(async () => {
    setIsGeneratingImages(true);
    setError(null);

    try {
      const response = await fetch('/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `App icon and feature images for: ${formData.appName}`,
          features: formData.features.filter((f) => f.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate images');
      }

      const data = await response.json();
      setImages(data.images || []);
      setSuccess('Images generated successfully!');
    } catch {
      setError('Failed to generate images. Please try again.');
    } finally {
      setIsGeneratingImages(false);
    }
  }, [formData.appName, formData.features]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save submission');
      }

      setSuccess('Submission saved successfully!');
    } catch {
      setError('Failed to save submission. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [formData]);

  const handleExport = useCallback(async () => {
    // Export functionality - to be implemented with export API
    setSuccess('Export feature coming soon!');
  }, []);

  const handleRegenerateImage = useCallback(async (_id: string) => {
    // Regenerate specific image - to be implemented
  }, []);

  const handleDownloadImage = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image) {
        window.open(image.url, '_blank');
      }
    },
    [images]
  );

  // Memoized form handlers for performance
  const handleAppNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, appName: e.target.value }));
  }, []);

  const handleAppIntroChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, appIntroduction: e.target.value }));
  }, []);

  const handleAppDescChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, appDescription: e.target.value }));
  }, []);

  const handleFeaturesChange = useCallback((features: string[]) => {
    setFormData((prev) => ({ ...prev, features }));
  }, []);

  const progress = calculateProgress();

  // Secure URL validation - prevents XSS and ensures proper protocol
  const isUrlValid = useMemo(() => {
    if (!formData.landingPageUrl) return false;
    try {
      const url = new URL(formData.landingPageUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, [formData.landingPageUrl]);

  return (
    <MainLayout>
      <div className="container max-w-7xl mx-auto py-6 px-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Create your Shopify App Store submission</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6">
            <AlertMessage variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {success && (
          <div className="mb-6">
            <AlertMessage variant="success" message={success} onDismiss={() => setSuccess(null)} />
          </div>
        )}

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Submission Progress</span>
              <span className="text-sm text-muted-foreground">{progress}% Complete</span>
            </div>
            <ProgressBar value={progress} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* URL Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Landing Page Analysis
                </CardTitle>
                <CardDescription>
                  Enter your app landing page URL to auto-fill the form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <URLInput
                  label="Landing Page URL"
                  value={formData.landingPageUrl}
                  onChange={handleUrlChange}
                  showValidation
                  placeholder="https://your-app.com"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!isUrlValid || isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Info</CardTitle>
                <CardDescription>Your app name and descriptions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CharacterCountInput
                  label="App Name"
                  value={formData.appName}
                  onChange={handleAppNameChange}
                  maxLength={LIMITS.appName}
                  placeholder="Your App Name"
                  helperText="Must start with your brand term"
                />

                <CharacterCountInput
                  label="App Introduction (Tagline)"
                  value={formData.appIntroduction}
                  onChange={handleAppIntroChange}
                  maxLength={LIMITS.appIntroduction}
                  placeholder="A short tagline for your app"
                />

                <CharacterCountTextarea
                  label="App Description"
                  value={formData.appDescription}
                  onChange={handleAppDescChange}
                  maxLength={LIMITS.appDescription}
                  placeholder="Describe what your app does..."
                  helperText="No contact information or unverifiable claims"
                  rows={6}
                />
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
                <CardDescription>List the key features of your app</CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureListEditor
                  features={formData.features}
                  onChange={handleFeaturesChange}
                  maxItems={LIMITS.maxFeatures}
                  maxCharPerItem={LIMITS.featureItem}
                  helperText="Each feature should highlight a unique capability"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Images & Actions */}
          <div className="space-y-6">
            {/* Generated Images */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Generated Images
                </CardTitle>
                <CardDescription>App icon and feature images for your listing</CardDescription>
              </CardHeader>
              <CardContent>
                {images.length > 0 ? (
                  <ImageGallery
                    images={images}
                    onRegenerate={handleRegenerateImage}
                    onDownload={handleDownloadImage}
                  />
                ) : (
                  <EmptyState
                    title="No Images Generated"
                    description="Generate images based on your app features"
                    icon="image"
                    actionLabel="Generate Images"
                    onAction={handleGenerateImages}
                  />
                )}

                {images.length > 0 && (
                  <Button
                    onClick={handleGenerateImages}
                    disabled={isGeneratingImages}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    {isGeneratingImages ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Regenerate All Images
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleGenerateImages}
                  disabled={isGeneratingImages || !formData.appName}
                  variant="secondary"
                  className="w-full"
                >
                  {isGeneratingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Generate Images
                    </>
                  )}
                </Button>

                <Separator />

                <Button
                  onClick={handleExport}
                  disabled={progress < 80}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Package
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
