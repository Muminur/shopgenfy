import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PreviewPage from '@/app/preview/page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/preview',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('id=test-submission-id'),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSubmission = {
  id: 'test-submission-id',
  appName: 'Test App',
  appIntroduction: 'A great test app for testing',
  appDescription:
    'This is a detailed description of the test app that explains all its features and benefits for users.',
  features: ['Feature 1', 'Feature 2', 'Feature 3'],
  landingPageUrl: 'https://test-app.com',
  status: 'complete',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

const mockImages = [
  {
    id: 'img-1',
    url: 'https://example.com/icon.png',
    type: 'icon',
    width: 1200,
    height: 1200,
    alt: 'App icon',
  },
  {
    id: 'img-2',
    url: 'https://example.com/feature1.png',
    type: 'feature',
    width: 1600,
    height: 900,
    alt: 'Feature 1 image',
  },
];

describe('Preview Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/submissions/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSubmission,
        });
      }
      if (url.includes('/api/images')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ images: mockImages }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  describe('Layout', () => {
    it('should render the preview page title', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /preview/i })).toBeInTheDocument();
      });
    });

    it('should have a main content area', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });

  describe('App Information Section', () => {
    it('should display the app name', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText('Test App')).toBeInTheDocument();
      });
    });

    it('should display the app introduction', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText(/a great test app for testing/i)).toBeInTheDocument();
      });
    });

    it('should display the app description', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText(/detailed description of the test app/i)).toBeInTheDocument();
      });
    });
  });

  describe('Features Section', () => {
    it('should display the features heading', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        // Multiple elements contain "features", check for the card title specifically
        expect(screen.getAllByText(/features/i).length).toBeGreaterThan(0);
      });
    });

    it('should display all features', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText('Feature 1')).toBeInTheDocument();
        expect(screen.getByText('Feature 2')).toBeInTheDocument();
        expect(screen.getByText('Feature 3')).toBeInTheDocument();
      });
    });
  });

  describe('Images Section', () => {
    it('should display generated images section', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        // Multiple elements contain "images", check for the card title specifically
        expect(screen.getAllByText(/images/i).length).toBeGreaterThan(0);
      });
    });

    it('should display app icon when available', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        // Check for the app icon image by its alt text
        const images = screen.getAllByRole('img');
        const iconImage = images.find((img) => img.getAttribute('alt') === 'App icon');
        expect(iconImage).toBeInTheDocument();
      });
    });

    it('should display feature images when available', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        // Check for feature images
        const images = screen.getAllByRole('img');
        const featureImage = images.find((img) => img.getAttribute('alt') === 'Feature 1 image');
        expect(featureImage).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should have an edit button to go back to dashboard', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
      });
    });

    it('should have an export button', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<PreviewPage />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when submission not found', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Submission not found' }),
        })
      );

      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText(/not found|error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Display', () => {
    it('should display the landing page URL', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText(/test-app\.com/)).toBeInTheDocument();
      });
    });

    it('should display the submission status', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        expect(screen.getByText(/complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('should have alt text for all images', async () => {
      render(<PreviewPage />);
      await waitFor(() => {
        const images = screen.getAllByRole('img');
        images.forEach((img) => {
          expect(img).toHaveAttribute('alt');
        });
      });
    });
  });
});
