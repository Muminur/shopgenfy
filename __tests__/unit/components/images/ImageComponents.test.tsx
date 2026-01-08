import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

describe('Image Components', () => {
  describe('ImagePreviewCard', () => {
    const mockImage = {
      id: 'img-1',
      url: 'https://example.com/image.png',
      type: 'icon' as const,
      width: 1200,
      height: 1200,
      alt: 'App Icon',
    };

    it('should render image with alt text', async () => {
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} />);

      const img = screen.getByAltText('App Icon');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('image.png'));
    });

    it('should display image type badge', async () => {
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} />);

      expect(screen.getByText(/icon/i)).toBeInTheDocument();
    });

    it('should display image dimensions', async () => {
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} />);

      expect(screen.getByText('1200×1200')).toBeInTheDocument();
    });

    it('should call onRegenerate when regenerate button is clicked', async () => {
      const onRegenerate = vi.fn();
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} onRegenerate={onRegenerate} />);

      const regenerateButton = screen.getByRole('button', { name: /regenerate/i });
      fireEvent.click(regenerateButton);

      expect(onRegenerate).toHaveBeenCalledWith('img-1');
    });

    it('should call onDownload when download button is clicked', async () => {
      const onDownload = vi.fn();
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} onDownload={onDownload} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      expect(onDownload).toHaveBeenCalledWith('img-1');
    });

    it('should show loading state during regeneration', async () => {
      const { ImagePreviewCard } = await import('@/components/images/ImagePreviewCard');
      render(<ImagePreviewCard image={mockImage} isRegenerating />);

      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });
  });

  describe('ImageGallery', () => {
    const mockImages = [
      {
        id: 'img-1',
        url: 'https://example.com/1.png',
        type: 'icon' as const,
        width: 1200,
        height: 1200,
        alt: 'Icon',
      },
      {
        id: 'img-2',
        url: 'https://example.com/2.png',
        type: 'feature' as const,
        width: 1600,
        height: 900,
        alt: 'Feature 1',
      },
      {
        id: 'img-3',
        url: 'https://example.com/3.png',
        type: 'feature' as const,
        width: 1600,
        height: 900,
        alt: 'Feature 2',
      },
    ];

    it('should render all images', async () => {
      const { ImageGallery } = await import('@/components/images/ImageGallery');
      render(<ImageGallery images={mockImages} />);

      expect(screen.getByAltText('Icon')).toBeInTheDocument();
      expect(screen.getByAltText('Feature 1')).toBeInTheDocument();
      expect(screen.getByAltText('Feature 2')).toBeInTheDocument();
    });

    it('should display empty state when no images', async () => {
      const { ImageGallery } = await import('@/components/images/ImageGallery');
      render(<ImageGallery images={[]} />);

      expect(screen.getByText(/no images/i)).toBeInTheDocument();
    });

    it('should group images by type', async () => {
      const { ImageGallery } = await import('@/components/images/ImageGallery');
      render(<ImageGallery images={mockImages} groupByType />);

      expect(screen.getByText(/app icon/i)).toBeInTheDocument();
      expect(screen.getByText(/feature images/i)).toBeInTheDocument();
    });

    it('should call onRegenerateAll when button is clicked', async () => {
      const onRegenerateAll = vi.fn();
      const { ImageGallery } = await import('@/components/images/ImageGallery');
      render(<ImageGallery images={mockImages} onRegenerateAll={onRegenerateAll} />);

      const regenerateAllButton = screen.getByRole('button', { name: /regenerate all/i });
      fireEvent.click(regenerateAllButton);

      expect(onRegenerateAll).toHaveBeenCalled();
    });
  });
});
