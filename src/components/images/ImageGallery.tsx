'use client';

import { RefreshCw, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ImagePreviewCard } from './ImagePreviewCard';

interface ImageData {
  id: string;
  url: string;
  type: 'icon' | 'feature';
  width: number;
  height: number;
  alt: string;
}

interface ImageGalleryProps {
  images: ImageData[];
  onRegenerate?: (id: string) => void;
  onDownload?: (id: string) => void;
  onRegenerateAll?: () => void;
  groupByType?: boolean;
  regeneratingIds?: string[];
  className?: string;
}

export function ImageGallery({
  images,
  onRegenerate,
  onDownload,
  onRegenerateAll,
  groupByType = false,
  regeneratingIds = [],
  className,
}: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No images generated</h3>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Generate images from your app description
        </p>
      </div>
    );
  }

  const iconImages = images.filter((img) => img.type === 'icon');
  const featureImages = images.filter((img) => img.type === 'feature');

  const renderImages = (imgs: ImageData[], title?: string) => (
    <div className="space-y-4">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {imgs.map((image) => (
          <ImagePreviewCard
            key={image.id}
            image={image}
            onRegenerate={onRegenerate}
            onDownload={onDownload}
            isRegenerating={regeneratingIds.includes(image.id)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with regenerate all button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Generated Images</h2>
        {onRegenerateAll && (
          <Button variant="outline" size="sm" onClick={onRegenerateAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate All
          </Button>
        )}
      </div>

      {/* Images */}
      {groupByType ? (
        <div className="space-y-8">
          {iconImages.length > 0 && renderImages(iconImages, 'App Icon')}
          {featureImages.length > 0 && renderImages(featureImages, 'Feature Images')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <ImagePreviewCard
              key={image.id}
              image={image}
              onRegenerate={onRegenerate}
              onDownload={onDownload}
              isRegenerating={regeneratingIds.includes(image.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
