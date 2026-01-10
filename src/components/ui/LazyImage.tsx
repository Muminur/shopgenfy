'use client';

import { forwardRef } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

export interface LazyImageProps extends ImageProps {
  /**
   * If true, image will be loaded with priority (no lazy loading)
   * Use for above-the-fold images
   */
  priority?: boolean;
}

/**
 * Optimized image component with built-in lazy loading
 * Uses Next.js Image component with automatic optimization
 *
 * - Lazy loads by default (loading="lazy")
 * - Priority loading for above-the-fold images
 * - Automatic format optimization (WebP, AVIF)
 * - Responsive image sizing
 */
export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(
  ({ priority = false, className, alt, ...props }, ref) => {
    return (
      <Image
        ref={ref}
        alt={alt}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={cn(className)}
        {...props}
      />
    );
  }
);

LazyImage.displayName = 'LazyImage';
