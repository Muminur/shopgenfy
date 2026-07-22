'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { CharacterCountInput } from '@/components/forms/CharacterCountInput';
import { CharacterCountTextarea } from '@/components/forms/CharacterCountTextarea';
import { URLInput } from '@/components/forms/URLInput';
import { FeatureListEditor } from '@/components/forms/FeatureListEditor';
import { MultiSelect } from '@/components/forms/MultiSelect';
import { CategorySelect } from '@/components/forms/CategorySelect';
import { PricingBuilder } from '@/components/forms/PricingBuilder';
import { ImageGallery } from '@/components/images/ImageGallery';
import { ScreenshotDropzone } from '@/components/forms/ScreenshotDropzone';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { AlertMessage } from '@/components/feedback/AlertMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Download,
  Save,
  Globe,
  Github,
  FolderUp,
  ImageIcon,
  Loader2,
  Languages,
  Tag,
  Eye,
  Wand2,
  Images,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, SHOPIFY_INTEGRATIONS } from '@/lib/validators/constants';
import { PricingConfig } from '@/types';
import { usePreviewSync, PreviewFormData } from '@/hooks/usePreviewSync';
import { apiFetch, saveDraft, SUBMISSION_ID_STORAGE_KEY } from '@/lib/api-client';
import type { StoredImage } from '@/lib/image-store';
import {
  getEligibleScreenshots,
  type ExtractedScreenshot,
  type ScreenshotOrigin,
  type ScreenshotSource,
} from '@/lib/screenshot-eligibility';
import { cn } from '@/lib/utils';

// Screenshot-source preference (Settings) persisted client-side so the
// dashboard honors it even when the settings API/DB is unavailable.
const SCREENSHOT_SOURCE_STORAGE_KEY = 'shopgenfy_screenshot_source';

function isValidScreenshotSource(value: unknown): value is ScreenshotSource {
  return value === 'website' || value === 'repo' || value === 'folder';
}

// Decode a base64 payload (an analyzed-source screenshot) into a Blob so it can
// be uploaded through the same normalize+store route as folder uploads.
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'image/png' });
}

// Segmented-control tab trigger styling (active vs inactive), matching the
// repo's muted-surface pattern. Hand-rolled to avoid a new radix dependency.
function tabTriggerClass(active: boolean): string {
  return cn(
    'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  );
}

// Helper to sanitize text for image prompts - removes Shopify branding and URLs
function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bshopify\b/gi, '') // Remove Shopify branding (case insensitive)
    .replace(/https?:\/\/[^\s]+/gi, '') // Remove URLs
    .replace(/www\.[^\s]+/gi, '') // Remove www URLs
    .replace(/\s+/g, ' ') // Clean up multiple spaces
    .trim();
}

interface FormData {
  landingPageUrl: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  features: string[];
  languages: string[];
  worksWith: string[];
  primaryCategory: string;
  secondaryCategory: string;
  pricing: PricingConfig;
}

const initialFormData: FormData = {
  landingPageUrl: '',
  appName: '',
  appIntroduction: '',
  appDescription: '',
  features: [''],
  languages: [],
  worksWith: [],
  primaryCategory: '',
  secondaryCategory: '',
  pricing: { type: 'free' },
};

// Shopify character limits
const LIMITS = {
  appName: 30,
  appIntroduction: 100,
  appDescription: 500,
  featureItem: 80,
  maxFeatures: 10,
};

// Build a submission payload that validates against BOTH the POST route
// (which maps features -> featureList) and the PUT [id] route (which does NOT
// transform): send featureList directly and omit empty optional fields.
function buildSubmissionPayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    appName: formData.appName,
    appIntroduction: formData.appIntroduction,
    appDescription: formData.appDescription,
    featureList: formData.features,
    languages: formData.languages,
    worksWith: formData.worksWith,
    pricing: formData.pricing,
    featureTags: [],
    status: 'draft',
  };
  if (formData.primaryCategory) payload.primaryCategory = formData.primaryCategory;
  if (formData.secondaryCategory) payload.secondaryCategory = formData.secondaryCategory;
  if (formData.landingPageUrl) payload.landingPageUrl = formData.landingPageUrl;
  return payload;
}

export default function DashboardPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingWithImagen, setIsGeneratingWithImagen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<
    {
      id: string;
      url: string;
      type: 'icon' | 'feature';
      width: number;
      height: number;
      alt: string;
      // Which backend produced the image — drives per-provider regeneration.
      provider: 'pollinations' | 'gemini' | 'upload';
      // The feature this image showcases, carried on the object so regeneration
      // never has to parse it back out of alt text.
      featureText?: string;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Screenshots extracted from any analyzed source (URL / GitHub repo / local
  // source) for Imagen feature image generation. Each is tagged with its origin
  // (`sourceType`) so the Settings screenshot-source preference can decide which
  // ones are eligible to feed feature images.
  const [extractedScreenshots, setExtractedScreenshots] = useState<ExtractedScreenshot[]>([]);

  // Which input source the user is analyzing from. All three funnel through the
  // shared applyAnalysis() result-application path.
  const [inputTab, setInputTab] = useState<'url' | 'github' | 'source'>('url');
  const [githubUrl, setGithubUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);

  // Screenshot-source preference from Settings (default 'website'). In 'folder'
  // mode the dashboard shows an upload dropzone whose images become feature
  // images directly (no AI).
  const [screenshotSource, setScreenshotSource] = useState<ScreenshotSource>('website');
  const [isUsingScreenshots, setIsUsingScreenshots] = useState(false);

  useEffect(() => {
    // 1) Immediate localStorage read so the preference applies even offline /
    //    with the settings DB down (a supported first-class state for this app).
    try {
      const stored = localStorage.getItem(SCREENSHOT_SOURCE_STORAGE_KEY);
      if (isValidScreenshotSource(stored)) {
        setScreenshotSource(stored);
      }
    } catch {
      /* localStorage unavailable */
    }

    // 2) Refine from the server when reachable. Only override on a VALID server
    //    value — an empty/error response leaves the localStorage-derived choice
    //    intact (matching how the Settings page itself falls back).
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled && isValidScreenshotSource(data?.screenshotSource)) {
          setScreenshotSource(data.screenshotSource);
          try {
            localStorage.setItem(SCREENSHOT_SOURCE_STORAGE_KEY, data.screenshotSource);
          } catch {
            /* localStorage unavailable */
          }
        }
      } catch {
        /* settings API unreachable — localStorage value already applied */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Preview sync hook for real-time preview synchronization
  const { saveToPreview, lastSynced } = usePreviewSync({ debounceMs: 500 });

  // Persisted submission id for upsert auto-save: POST once, then PUT the same
  // document. Hydrated from localStorage so a reload keeps the same draft.
  const submissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SUBMISSION_ID_STORAGE_KEY);
      if (stored) submissionIdRef.current = stored;
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const persistDraft = useCallback(async () => {
    const payload = buildSubmissionPayload(formData);
    const { id } = await saveDraft(payload, submissionIdRef.current);
    if (id) {
      submissionIdRef.current = id;
      try {
        localStorage.setItem(SUBMISSION_ID_STORAGE_KEY, id);
      } catch {
        /* localStorage unavailable */
      }
    }
  }, [formData]);

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

  // Shared result-application path used by all three input sources. Applies the
  // exact same fields the URL path always has (API returns featureList, mapped
  // to the form's features), and lands screenshots from any source in the same
  // extractedScreenshots state.
  const applyAnalysis = useCallback(
    (
      data: {
        appName?: string;
        appIntroduction?: string;
        appDescription?: string;
        featureList?: string[];
        languages?: string[];
        primaryCategory?: string;
        screenshots?: ExtractedScreenshot[];
        warnings?: string[];
      },
      // Origin of any harvested screenshots (which analyze handler produced
      // them). Tagged onto each screenshot so the Settings screenshot-source
      // preference can filter which ones are eligible for feature images.
      origin: ScreenshotOrigin
    ) => {
      setFormData((prev) => ({
        ...prev,
        appName: data.appName || prev.appName,
        appIntroduction: data.appIntroduction || prev.appIntroduction,
        appDescription: data.appDescription || prev.appDescription,
        features:
          data.featureList && data.featureList.length > 0 ? data.featureList : prev.features,
        languages: data.languages && data.languages.length > 0 ? data.languages : prev.languages,
        primaryCategory: data.primaryCategory || prev.primaryCategory,
      }));

      // Surface any degraded-path notes (retired-model fallback, prompt-only
      // image fallback, etc.) so fallbacks are never silent.
      const warningNote =
        data.warnings && data.warnings.length > 0 ? ` Note: ${data.warnings.join(' ')}` : '';

      if (data.screenshots && data.screenshots.length > 0) {
        const tagged = data.screenshots.map((shot) => ({
          ...shot,
          sourceType: shot.sourceType ?? origin,
        }));
        setExtractedScreenshots(tagged);
        setSuccess(
          `Analyzed successfully! Found ${tagged.length} screenshot(s) for feature image generation.${warningNote}`
        );
      } else {
        setExtractedScreenshots([]);
        setSuccess(`Analyzed successfully!${warningNote}`);
      }
    },
    []
  );

  const handleAnalyzeUrl = useCallback(async () => {
    if (!formData.landingPageUrl) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.landingPageUrl, sourceType: 'url' }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze landing page');
      }

      applyAnalysis(await response.json(), 'url');
    } catch {
      setError('Failed to analyze landing page. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [formData.landingPageUrl, applyAnalysis]);

  const handleAnalyzeGitHub = useCallback(async () => {
    if (!githubUrl.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl.trim(), sourceType: 'github' }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to analyze repository');
      }

      applyAnalysis(await response.json(), 'github');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze the GitHub repository';
      setError(`${message}. Please check the URL and try again.`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [githubUrl, applyAnalysis]);

  const handleAnalyzeSource = useCallback(async () => {
    if (!sourceFile && !sourceText.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // A zip upload goes as multipart form-data (field "file"); pasted text
      // goes as JSON { text }. An uploaded file takes precedence when both exist.
      let response: Response;
      if (sourceFile) {
        const form = new FormData();
        form.append('file', sourceFile);
        response = await apiFetch('/api/analyze/source', { method: 'POST', body: form });
      } else {
        response = await apiFetch('/api/analyze/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sourceText }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to analyze source');
      }

      applyAnalysis(await response.json(), 'source');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze source';
      setError(`${message}. Please try again.`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sourceFile, sourceText, applyAnalysis]);

  const handleSourceFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSourceFile(e.target.files?.[0] ?? null);
  }, []);

  // Direct-use path: normalized+stored screenshots (from the folder dropzone)
  // become feature images WITHOUT any AI generation. Append so an uploaded
  // feature never wipes a previously generated icon.
  const handleUploadedScreenshots = useCallback((stored: StoredImage[]) => {
    if (stored.length === 0) return;
    const mapped = stored.map((img) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      width: img.width,
      height: img.height,
      alt: img.altText,
      provider: img.provider,
      featureText: img.featureText,
    }));
    setImages((prev) => [...prev, ...mapped]);
    setSuccess(`Added ${mapped.length} screenshot(s) as feature image(s).`);
  }, []);

  // Direct-use path for screenshots harvested from an analyzed source: send the
  // decoded bytes through the same normalize+store upload route, then append the
  // results as feature images — again, no AI generation.
  const handleUseScreenshotsDirectly = useCallback(async () => {
    // Only screenshots whose origin matches the current screenshot-source
    // preference are eligible (folder = your own uploads/zip; website = url;
    // repo = github).
    const usable = getEligibleScreenshots(extractedScreenshots, screenshotSource).filter(
      (s) => s.base64 && s.mimeType
    );
    if (usable.length === 0) return;

    setIsUsingScreenshots(true);
    setError(null);

    try {
      const stored: StoredImage[] = [];
      for (const shot of usable) {
        const blob = base64ToBlob(shot.base64 as string, shot.mimeType as string);
        const form = new FormData();
        form.append('file', blob, 'screenshot.png');
        form.append('kind', 'feature');
        if (submissionIdRef.current) form.append('submissionId', submissionIdRef.current);
        if (shot.alt) form.append('altText', shot.alt);

        const res = await apiFetch('/api/screenshots/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to store screenshot (${res.status})`);
        }
        const data = await res.json();
        if (data.image) stored.push(data.image as StoredImage);
      }

      handleUploadedScreenshots(stored);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to use screenshots';
      setError(`${message}. Please try again.`);
    } finally {
      setIsUsingScreenshots(false);
    }
  }, [extractedScreenshots, screenshotSource, handleUploadedScreenshots]);

  const handleGenerateImages = useCallback(async () => {
    setIsGeneratingImages(true);
    setError(null);

    try {
      const generatedImages: typeof images = [];
      const warnings: string[] = [];
      const features = formData.features.filter((f) => f.trim());

      // Sanitize all content to remove Shopify branding before using in prompts
      const sanitizedAppName = sanitizeForPrompt(formData.appName);
      const sanitizedDescription = sanitizeForPrompt(formData.appDescription);
      const sanitizedIntro = sanitizeForPrompt(formData.appIntroduction);
      const sanitizedCategory = sanitizeForPrompt(formData.primaryCategory);

      // Build rich context from extracted URL content (sanitized)
      const appContext = [
        sanitizedDescription,
        sanitizedIntro,
        sanitizedCategory ? `Category: ${sanitizedCategory}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      // Generate app icon first with rich context
      const iconPrompt = [
        `Professional app icon for "${sanitizedAppName}"`,
        sanitizedCategory ? `a ${sanitizedCategory} application` : '',
        appContext ? `Context: ${appContext.slice(0, 150)}` : '',
        'Style: modern, flat design, minimalist, simple geometric shapes',
        'high contrast, vibrant colors, single focal point, centered composition',
        'suitable for app store listing',
      ]
        .filter(Boolean)
        .join('. ');

      const iconResponse = await apiFetch('/api/nanobanana/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'icon',
          prompt: iconPrompt,
          style: 'modern',
        }),
      });

      if (iconResponse.ok) {
        const iconData = await iconResponse.json();
        if (Array.isArray(iconData.warnings)) warnings.push(...iconData.warnings);
        if (iconData.image) {
          generatedImages.push({
            id: iconData.image.id || `icon-${Date.now()}`,
            url: iconData.image.url,
            type: 'icon',
            width: iconData.image.width || 1200,
            height: iconData.image.height || 1200,
            alt: iconData.image.altText || `${formData.appName} app icon`,
            provider: iconData.image.provider || 'pollinations',
          });
        }
      }

      // Generate feature images for each feature (max 3 to avoid rate limits)
      const featuresToGenerate = features.slice(0, 3);
      for (const feature of featuresToGenerate) {
        // Sanitize feature text
        const sanitizedFeature = sanitizeForPrompt(feature);

        // Build rich feature prompt using extracted content (sanitized)
        const featurePrompt = [
          `Feature showcase image for "${sanitizedAppName}" app`,
          `Highlighting: "${sanitizedFeature}"`,
          sanitizedCategory ? `Category: ${sanitizedCategory}` : '',
          sanitizedDescription ? `App description: ${sanitizedDescription.slice(0, 100)}` : '',
          'Style: modern UI mockup, clean interface design, professional dashboard visualization',
          'high contrast, clear visual hierarchy, 16:9 aspect ratio',
          'suitable for app store feature gallery',
        ]
          .filter(Boolean)
          .join('. ');

        const featureResponse = await apiFetch('/api/nanobanana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'feature',
            prompt: featurePrompt,
            featureHighlight: feature,
            style: 'modern',
          }),
        });

        if (featureResponse.ok) {
          const featureData = await featureResponse.json();
          if (Array.isArray(featureData.warnings)) warnings.push(...featureData.warnings);
          if (featureData.image) {
            generatedImages.push({
              id: featureData.image.id || `feature-${Date.now()}-${feature.slice(0, 10)}`,
              url: featureData.image.url,
              type: 'feature',
              width: featureData.image.width || 1600,
              height: featureData.image.height || 900,
              alt: featureData.image.altText || `${formData.appName} - ${feature}`,
              provider: featureData.image.provider || 'pollinations',
              featureText: featureData.image.featureText || feature,
            });
          }
        }
      }

      if (generatedImages.length > 0) {
        setImages(generatedImages);
        const warningNote = warnings.length > 0 ? ` Note: ${warnings.join(' ')}` : '';
        setSuccess(`Generated ${generatedImages.length} image(s) successfully!${warningNote}`);
      } else {
        throw new Error('No images were generated');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate images';
      setError(`${message}. Please try again or check your network connection.`);
    } finally {
      setIsGeneratingImages(false);
    }
  }, [
    formData.appName,
    formData.appIntroduction,
    formData.appDescription,
    formData.primaryCategory,
    formData.features,
  ]);

  // Handler for generating images with Google Imagen API
  const handleGenerateWithImagen = useCallback(async () => {
    setIsGeneratingWithImagen(true);
    setError(null);

    try {
      const features = formData.features.filter((f) => f.trim());

      if (features.length === 0) {
        throw new Error('Please add at least one feature to generate images');
      }

      // Prepare screenshots for the API: only those whose origin matches the
      // current screenshot-source preference (a 'website' preference must never
      // silently feed GitHub/local screenshots to AI generation) and that
      // actually carry decoded bytes.
      const screenshotsForApi = getEligibleScreenshots(extractedScreenshots, screenshotSource)
        .filter((s) => s.base64 && s.mimeType)
        .map((s) => ({
          base64: s.base64!,
          mimeType: s.mimeType!,
          alt: s.alt,
        }));

      // Use the Imagen API to generate all images
      // If screenshots are available, they will be used for feature image generation
      const response = await apiFetch('/api/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'all',
          appName: formData.appName || 'My App',
          appDescription: formData.appDescription || formData.appIntroduction,
          features,
          screenshots: screenshotsForApi.length > 0 ? screenshotsForApi : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate images (${response.status})`);
      }

      const data = await response.json();

      if (data.images && data.images.length > 0) {
        const generatedImages = data.images.map(
          (img: {
            id: string;
            url: string;
            type: 'icon' | 'feature';
            width: number;
            height: number;
            altText: string;
            provider?: 'pollinations' | 'gemini' | 'upload';
            featureText?: string;
          }) => ({
            id: img.id,
            url: img.url,
            type: img.type,
            width: img.width,
            height: img.height,
            alt: img.altText,
            provider: img.provider || 'gemini',
            featureText: img.featureText,
          })
        );
        setImages(generatedImages);

        // Surface any compliance/degraded-path warnings (e.g. prompt-only
        // feature images that may not satisfy Shopify listing rule 4.4.4) so
        // the fallback is never silent.
        const warningNote =
          Array.isArray(data.warnings) && data.warnings.length > 0
            ? ` Note: ${data.warnings.join(' ')}`
            : '';

        // Show different success message based on whether screenshots were used
        const usedScreenshots = data.usedScreenshots || 0;
        if (usedScreenshots > 0) {
          setSuccess(
            `Generated ${generatedImages.length} image(s) with Google Imagen using ${usedScreenshots} extracted screenshot(s)! (App Icon: 1200x1200, Features: 1600x900)${warningNote}`
          );
        } else {
          setSuccess(
            `Generated ${generatedImages.length} image(s) with Google Imagen! (App Icon: 1200x1200, Features: 1600x900)${warningNote}`
          );
        }
      } else {
        throw new Error('No images were generated');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate images with Imagen';
      setError(`${message}. Please try again.`);
    } finally {
      setIsGeneratingWithImagen(false);
    }
  }, [
    formData.appName,
    formData.appIntroduction,
    formData.appDescription,
    formData.features,
    extractedScreenshots,
    screenshotSource,
  ]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await persistDraft();
      setSuccess('Submission saved successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save submission';
      setError(`${message}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  }, [persistDraft]);

  const handleExport = useCallback(async () => {
    if (images.length === 0) {
      setError('No images to export. Generate images first.');
      return;
    }

    setError(null);

    try {
      // Single stateless export: the server pulls the real PNG bytes from the
      // image store (by id) and streams back one ZIP with metadata + images.
      const response = await apiFetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission: {
            appName: formData.appName,
            appIntroduction: formData.appIntroduction,
            appDescription: formData.appDescription,
            features: formData.features.filter((f) => f.trim()),
            languages: formData.languages,
            worksWith: formData.worksWith,
            primaryCategory: formData.primaryCategory,
            secondaryCategory: formData.secondaryCategory,
            pricing: formData.pricing,
            landingPageUrl: formData.landingPageUrl,
          },
          imageIds: images.map((img) => img.id),
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      const base = formData.appName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'shopgenfy';
      link.download = `${base}-export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      setSuccess(`Exported ${images.length} image(s) and metadata successfully!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export package';
      setError(`${message}. Please try again.`);
    }
  }, [formData, images]);

  const handleRegenerateImage = useCallback(
    async (id: string) => {
      // Find the image to regenerate
      const imageToRegenerate = images.find((img) => img.id === id);
      if (!imageToRegenerate) {
        setError('Image not found');
        return;
      }

      // Uploaded screenshots are user-provided; there is nothing to regenerate.
      if (imageToRegenerate.provider === 'upload') {
        setError('Uploaded images cannot be regenerated. Upload a replacement instead.');
        return;
      }

      setIsGeneratingImages(true);
      setError(null);

      // Feature text is carried on the image object (never parsed from alt text).
      const featureText = imageToRegenerate.featureText || formData.features[0] || '';

      try {
        let endpoint: string;
        let requestBody: Record<string, unknown>;

        if (imageToRegenerate.provider === 'gemini') {
          // Premium path: the Imagen route builds its own prompt from structured
          // fields, so pass them directly rather than a pre-built prompt string.
          endpoint = '/api/imagen/generate';
          requestBody =
            imageToRegenerate.type === 'icon'
              ? {
                  type: 'icon',
                  appName: formData.appName || 'My App',
                  appDescription: formData.appDescription || formData.appIntroduction,
                }
              : {
                  type: 'feature',
                  appName: formData.appName || 'My App',
                  appDescription: formData.appDescription || formData.appIntroduction,
                  featureText,
                };
        } else {
          // Free path (Pollinations): build a sanitized prompt string.
          endpoint = '/api/nanobanana/generate';
          const sanitizedAppName = sanitizeForPrompt(formData.appName);
          const sanitizedDescription = sanitizeForPrompt(formData.appDescription);
          const sanitizedIntro = sanitizeForPrompt(formData.appIntroduction);
          const sanitizedCategory = sanitizeForPrompt(formData.primaryCategory);

          if (imageToRegenerate.type === 'icon') {
            const appContext = [
              sanitizedDescription,
              sanitizedIntro,
              sanitizedCategory ? `Category: ${sanitizedCategory}` : '',
            ]
              .filter(Boolean)
              .join('. ');

            requestBody = {
              type: 'icon',
              prompt: [
                `Professional app icon for "${sanitizedAppName}"`,
                sanitizedCategory ? `a ${sanitizedCategory} application` : '',
                appContext ? `Context: ${appContext.slice(0, 150)}` : '',
                'Style: modern, flat design, minimalist, simple geometric shapes',
                'high contrast, vibrant colors, single focal point, centered composition',
                'suitable for app store listing',
              ]
                .filter(Boolean)
                .join('. '),
              style: 'modern',
            };
          } else {
            const sanitizedFeature = sanitizeForPrompt(featureText);
            requestBody = {
              type: 'feature',
              prompt: [
                `Feature showcase image for "${sanitizedAppName}" app`,
                `Highlighting: "${sanitizedFeature}"`,
                sanitizedCategory ? `Category: ${sanitizedCategory}` : '',
                sanitizedDescription
                  ? `App description: ${sanitizedDescription.slice(0, 100)}`
                  : '',
                'Style: modern UI mockup, clean interface design, professional dashboard visualization',
                'high contrast, clear visual hierarchy, 16:9 aspect ratio',
                'suitable for app store feature gallery',
              ]
                .filter(Boolean)
                .join('. '),
              featureHighlight: featureText,
              style: 'modern',
            };
          }
        }

        const response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to regenerate image (${response.status})`);
        }

        const data = await response.json();
        if (data.image) {
          // Update the specific image in state, preserving provider/featureText.
          setImages((prevImages) =>
            prevImages.map((img) =>
              img.id === id
                ? {
                    ...img,
                    id: data.image.id || `${img.type}-${Date.now()}`,
                    url: data.image.url,
                    width: data.image.width || img.width,
                    height: data.image.height || img.height,
                    featureText: data.image.featureText ?? img.featureText,
                  }
                : img
            )
          );
          setSuccess('Image regenerated successfully!');
        } else {
          throw new Error('No image was returned');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to regenerate image';
        setError(`${message}. Please try again.`);
      } finally {
        setIsGeneratingImages(false);
      }
    },
    [
      images,
      formData.appName,
      formData.appDescription,
      formData.appIntroduction,
      formData.primaryCategory,
      formData.features,
    ]
  );

  const handleDownloadImage = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id);
      if (!image) return;

      try {
        // Fetch the stored PNG bytes and save via an anchor+Blob (works for the
        // same-origin /api/images/<id> URL; window.open(data:) was being blocked).
        const response = await apiFetch(image.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image (${response.status})`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        const base = formData.appName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'shopgenfy';
        link.download =
          image.type === 'icon' ? `${base}-icon.png` : `${base}-feature-${image.id.slice(-6)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch {
        setError('Failed to download image. Please try again.');
      }
    },
    [images, formData.appName]
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

  // NEW: Handlers for languages, integrations, categories, and pricing
  const handleLanguagesChange = useCallback((languages: string[]) => {
    setFormData((prev) => ({ ...prev, languages }));
  }, []);

  const handleWorksWithChange = useCallback((worksWith: string[]) => {
    setFormData((prev) => ({ ...prev, worksWith }));
  }, []);

  const handlePrimaryCategoryChange = useCallback((primaryCategory: string) => {
    setFormData((prev) => ({ ...prev, primaryCategory }));
  }, []);

  const handleSecondaryCategoryChange = useCallback((secondaryCategory: string) => {
    setFormData((prev) => ({ ...prev, secondaryCategory }));
  }, []);

  const handlePricingChange = useCallback((pricing: PricingConfig) => {
    setFormData((prev) => ({ ...prev, pricing }));
  }, []);

  // Auto-save functionality
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    // Don't auto-save on initial render
    if (!hasUserInteractedRef.current) {
      hasUserInteractedRef.current = true;
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save (30 seconds debounce)
    autoSaveTimerRef.current = setTimeout(() => {
      if (formData.appName || formData.appIntroduction) {
        // Upsert: POST once, then PUT the same draft (no duplicate documents).
        persistDraft().catch((error) => {
          // Silent fail for auto-save
          console.error('Auto-save failed:', error);
        });
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, persistDraft]);

  // Sync form data to localStorage for preview
  useEffect(() => {
    // Only sync if user has interacted and has some data
    if (!hasUserInteractedRef.current) return;
    if (!formData.appName && !formData.appIntroduction && !formData.appDescription) return;

    // Create preview data matching the PreviewFormData interface. Images are
    // carried as lightweight refs (ids/urls only) so the preview page can
    // rehydrate the gallery from the store without persisting any bytes.
    const previewData: PreviewFormData = {
      landingPageUrl: formData.landingPageUrl,
      appName: formData.appName,
      appIntroduction: formData.appIntroduction,
      appDescription: formData.appDescription,
      features: formData.features,
      languages: formData.languages,
      worksWith: formData.worksWith,
      primaryCategory: formData.primaryCategory,
      secondaryCategory: formData.secondaryCategory,
      pricing: formData.pricing,
      imageRefs: images.map((img) => ({
        id: img.id,
        url: img.url,
        type: img.type,
        altText: img.alt,
      })),
    };

    saveToPreview(previewData);
  }, [formData, images, saveToPreview]);

  const progress = calculateProgress();

  // Screenshots eligible for direct use under the current screenshot-source
  // preference. Real screenshots are the Shopify 4.4.4-compliant primary path,
  // so when any are eligible the "Use screenshots directly" action is surfaced
  // as the recommended CTA (over pure-AI generation).
  const eligibleScreenshots = useMemo(
    () => getEligibleScreenshots(extractedScreenshots, screenshotSource).filter((s) => s.base64),
    [extractedScreenshots, screenshotSource]
  );

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
            {/* Input Source Analysis — Website URL | GitHub Repo | Local Source.
                All three funnel through the shared applyAnalysis() result path. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Analyze Your App
                </CardTitle>
                <CardDescription>
                  Import from a website, a GitHub repo, or local source to auto-fill the form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tab triggers (hand-rolled segmented control; role=tab keeps them
                    out of getByRole('button') queries) */}
                <div
                  role="tablist"
                  aria-label="Input source"
                  className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputTab === 'url'}
                    onClick={() => setInputTab('url')}
                    className={tabTriggerClass(inputTab === 'url')}
                  >
                    <Globe className="h-4 w-4" />
                    Website URL
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputTab === 'github'}
                    onClick={() => setInputTab('github')}
                    className={tabTriggerClass(inputTab === 'github')}
                  >
                    <Github className="h-4 w-4" />
                    GitHub Repo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputTab === 'source'}
                    onClick={() => setInputTab('source')}
                    className={tabTriggerClass(inputTab === 'source')}
                  >
                    <FolderUp className="h-4 w-4" />
                    Local Source
                  </button>
                </div>

                {/* Website URL panel */}
                {inputTab === 'url' && (
                  <div
                    role="tabpanel"
                    className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out"
                  >
                    <URLInput
                      label="Landing Page URL"
                      value={formData.landingPageUrl}
                      onChange={handleUrlChange}
                      showValidation
                      placeholder="https://your-app.com"
                    />
                    <Button
                      onClick={handleAnalyzeUrl}
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
                  </div>
                )}

                {/* GitHub Repo panel */}
                {inputTab === 'github' && (
                  <div
                    role="tabpanel"
                    className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out"
                  >
                    <URLInput
                      label="GitHub Repository URL"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      showValidation
                      placeholder="https://github.com/owner/repo"
                      helperText="Public repositories work best. Set GITHUB_TOKEN to raise rate limits."
                    />
                    <Button
                      onClick={handleAnalyzeGitHub}
                      disabled={!githubUrl.trim() || isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Github className="h-4 w-4 mr-2" />
                          Analyze Repo
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Local Source panel */}
                {inputTab === 'source' && (
                  <div
                    role="tabpanel"
                    className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="source-zip">Upload source (.zip)</Label>
                      <Input
                        id="source-zip"
                        type="file"
                        accept=".zip,application/zip"
                        onChange={handleSourceFileChange}
                      />
                      <p className="text-sm text-muted-foreground">
                        A zip of your project (README, docs, screenshots). Max 30 MB.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source-text">Or paste a README / description</Label>
                      <Textarea
                        id="source-text"
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="Paste your app's README or a description of what it does..."
                        rows={6}
                      />
                    </div>
                    <Button
                      onClick={handleAnalyzeSource}
                      disabled={(!sourceFile && !sourceText.trim()) || isAnalyzing}
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
                          Analyze Source
                        </>
                      )}
                    </Button>
                  </div>
                )}
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

            {/* Languages & Integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Languages & Integrations
                </CardTitle>
                <CardDescription>Languages supported and integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MultiSelect
                  label="Languages"
                  options={SUPPORTED_LANGUAGES.map((lang) => ({
                    value: lang.code,
                    label: lang.name,
                  }))}
                  value={formData.languages}
                  onChange={handleLanguagesChange}
                  placeholder="Select supported languages"
                  helperText="Languages your app supports"
                />

                <MultiSelect
                  label="Works With"
                  options={SHOPIFY_INTEGRATIONS.map((integration) => ({
                    value: integration,
                    label: integration,
                  }))}
                  value={formData.worksWith}
                  onChange={handleWorksWithChange}
                  placeholder="Select integrations"
                  maxItems={6}
                  helperText="Maximum 6 Shopify integrations"
                />
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Categories
                </CardTitle>
                <CardDescription>App Store categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CategorySelect
                  label="Primary Category"
                  value={formData.primaryCategory}
                  onChange={handlePrimaryCategoryChange}
                  placeholder="Select primary category"
                />

                <CategorySelect
                  label="Secondary Category"
                  value={formData.secondaryCategory}
                  onChange={handleSecondaryCategoryChange}
                  placeholder="Select secondary category"
                  optional
                />
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Configure your app pricing model</CardDescription>
              </CardHeader>
              <CardContent>
                <PricingBuilder value={formData.pricing} onChange={handlePricingChange} />
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
                {/* Folder mode: upload your own screenshots. They are normalized
                    to Shopify specs and used directly as feature images (no AI —
                    the compliant 4.4.4 primary path). */}
                {screenshotSource === 'folder' && (
                  <div className="mb-4">
                    <ScreenshotDropzone
                      onUploaded={handleUploadedScreenshots}
                      submissionId={submissionIdRef.current ?? undefined}
                    />
                  </div>
                )}

                {/* Direct-use of screenshots harvested from an analyzed source —
                    only those eligible for the current screenshot-source
                    preference. This is the recommended (Shopify 4.4.4-compliant)
                    primary path, so it is styled prominently above pure-AI
                    generation. */}
                {eligibleScreenshots.length > 0 && (
                  <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        Recommended
                      </span>
                      <span className="text-sm font-medium">Use your real screenshots</span>
                    </div>
                    <Button
                      onClick={handleUseScreenshotsDirectly}
                      disabled={isUsingScreenshots}
                      className="w-full"
                    >
                      {isUsingScreenshots ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding screenshots...
                        </>
                      ) : (
                        <>
                          <Images className="h-4 w-4 mr-2" />
                          Use {eligibleScreenshots.length} screenshot(s) directly
                        </>
                      )}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Real screenshots are cropped to Shopify specs and used as feature images — the
                      recommended path for Shopify listing rule 4.4.4. AI generation below is a
                      fallback.
                    </p>
                  </div>
                )}

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

                <Button
                  onClick={handleGenerateWithImagen}
                  disabled={isGeneratingWithImagen || !formData.appName}
                  variant="secondary"
                  className="w-full"
                  data-testid="generate-imagen-button"
                >
                  {isGeneratingWithImagen ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating with Imagen...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate with Imagen
                    </>
                  )}
                </Button>

                <Separator />

                <Button asChild variant="outline" className="w-full">
                  <Link href="/preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Live Preview
                  </Link>
                </Button>

                {lastSynced && (
                  <p className="text-xs text-muted-foreground text-center">
                    Preview synced: {lastSynced.toLocaleTimeString()}
                  </p>
                )}

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
