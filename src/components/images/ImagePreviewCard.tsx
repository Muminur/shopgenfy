'use client';

import Image from 'next/image';
import { RefreshCw, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

interface ImageData {
  id: string;
  url: string;
  type: 'icon' | 'feature';
  width: number;
  height: number;
  alt: string;
}

interface ImagePreviewCardProps {
  image: ImageData;
  onRegenerate?: (id: string) => void;
  onDownload?: (id: string) => void;
  isRegenerating?: boolean;
  className?: string;
}

export function ImagePreviewCard({
  image,
  onRegenerate,
  onDownload,
  isRegenerating = false,
  className,
}: ImagePreviewCardProps) {
  const aspectRatio = image.type === 'icon' ? 'aspect-square' : 'aspect-video';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0 relative">
        <div className={cn('relative w-full', aspectRatio)}>
          {isRegenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="mt-2 text-sm text-muted-foreground">Generating...</span>
            </div>
          ) : (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
        </div>

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              image.type === 'icon'
                ? 'bg-primary/90 text-primary-foreground'
                : 'bg-secondary/90 text-secondary-foreground'
            )}
          >
            {image.type === 'icon' ? 'Icon' : 'Feature'}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between p-3">
        <span className="text-sm text-muted-foreground">
          {image.width}×{image.height}
        </span>

        <div className="flex items-center gap-2">
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRegenerate(image.id)}
              disabled={isRegenerating}
              aria-label="Regenerate image"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDownload(image.id)}
              disabled={isRegenerating}
              aria-label="Download image"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
