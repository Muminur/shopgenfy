'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import type { StoredImage } from '@/lib/image-store';

/**
 * Folder-mode screenshot uploader. The user picks a folder (or multiple image
 * files); each is normalized+stored server-side (`/api/screenshots/upload`) and
 * handed back as a {@link StoredImage} to be used directly as a feature image —
 * no AI generation involved (Shopify 4.4.4 primary path).
 */

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ACCEPTED_EXTENSION = /\.(png|jpe?g|webp)$/i;
const MAX_FILES = 20;
const MAX_DIMENSION = 4000;

export interface ScreenshotDropzoneProps {
  /** Called once per selection with every image that stored successfully. */
  onUploaded: (images: StoredImage[]) => void;
  /** Associate stored images with the current submission draft. */
  submissionId?: string;
  /** Which Shopify spec to normalize uploads to (default: feature 1600x900). */
  kind?: 'icon' | 'feature';
}

/**
 * Downscale an image whose largest edge exceeds MAX_DIMENSION before upload, so
 * we never ship a 8000px screenshot over the wire. Best-effort: canvas /
 * createImageBitmap are unavailable under jsdom (tests) and in some locked-down
 * environments, so any failure falls back to the original File untouched.
 */
async function maybeDownscale(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
      return file;
    }
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      bitmap.close?.();
      return file;
    }
    const scale = MAX_DIMENSION / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(ACCEPTED_EXTENSION, '.png'), { type: 'image/png' });
  } catch {
    return file;
  }
}

export function ScreenshotDropzone({
  onUploaded,
  submissionId,
  kind = 'feature',
}: ScreenshotDropzoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  // Remount the (uncontrolled) file input after each batch so re-selecting the
  // same folder fires onChange again. The shadcn Input does not forward a ref.
  const [inputKey, setInputKey] = useState(0);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);
      setAddedCount(0);

      // `accept` is ignored in directory-picker mode, so filter client-side.
      const files = Array.from(fileList)
        .filter(
          (f) =>
            ACCEPTED_MIME.includes((f.type || '').toLowerCase()) || ACCEPTED_EXTENSION.test(f.name)
        )
        .slice(0, MAX_FILES);

      if (files.length === 0) {
        setError('No PNG, JPG, or WebP images found in the selection.');
        setInputKey((k) => k + 1);
        return;
      }

      setIsUploading(true);
      const uploaded: StoredImage[] = [];
      try {
        // Sequential, one-file-per-request to stay under serverless body caps.
        for (const original of files) {
          const file = await maybeDownscale(original);
          const form = new FormData();
          form.append('file', file);
          form.append('kind', kind);
          if (submissionId) form.append('submissionId', submissionId);

          const res = await apiFetch('/api/screenshots/upload', { method: 'POST', body: form });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Upload failed (${res.status})`);
          }
          const data = await res.json();
          if (data.image) uploaded.push(data.image as StoredImage);
        }

        if (uploaded.length > 0) {
          setAddedCount(uploaded.length);
          onUploaded(uploaded);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        setInputKey((k) => k + 1);
      }
    },
    [onUploaded, submissionId, kind]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="screenshot-folder">Upload screenshots (folder)</Label>
      <Input
        key={inputKey}
        id="screenshot-folder"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={isUploading}
        onChange={(e) => handleFiles(e.target.files)}
        // Directory picker; not in the standard input prop types.
        {...({ webkitdirectory: '' } as Record<string, string>)}
      />
      <p className="text-sm text-muted-foreground">
        PNG, JPG, or WebP. Up to {MAX_FILES} files; each is auto-cropped to Shopify specs and used
        directly as a feature image.
      </p>
      {isUploading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading and normalizing...
        </p>
      )}
      {addedCount > 0 && !isUploading && (
        <p className="text-sm text-muted-foreground">Added {addedCount} screenshot(s).</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
