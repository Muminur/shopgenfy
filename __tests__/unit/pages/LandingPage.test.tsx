import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from '@/app/page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Landing Page', () => {
  describe('Hero Section', () => {
    it('should render the hero section with app title', () => {
      render(<LandingPage />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      // Check that Shopgenfy appears in the page
      expect(screen.getAllByText(/shopgenfy/i).length).toBeGreaterThan(0);
    });

    it('should render a compelling tagline/subtitle', () => {
      render(<LandingPage />);
      // Check for Shopify App Store text in the h1
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent(/shopify app store/i);
    });

    it('should have a primary CTA button to get started', () => {
      render(<LandingPage />);
      const ctaButton = screen.getByRole('link', { name: /get started/i });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('Features Section', () => {
    it('should render feature highlights', () => {
      render(<LandingPage />);
      // Should have feature section with "Features" text
      expect(screen.getByText(/powerful features/i)).toBeInTheDocument();
    });

    it('should display AI-powered analysis feature', () => {
      render(<LandingPage />);
      expect(screen.getByText(/ai landing page analysis/i)).toBeInTheDocument();
    });

    it('should display image generation feature', () => {
      render(<LandingPage />);
      expect(screen.getByText(/smart image generation/i)).toBeInTheDocument();
    });

    it('should display export feature', () => {
      render(<LandingPage />);
      // Use getAllByText since "export" appears multiple times
      expect(screen.getAllByText(/one-click export/i).length).toBeGreaterThan(0);
    });
  });

  describe('How It Works Section', () => {
    it('should display the workflow steps', () => {
      render(<LandingPage />);
      expect(screen.getByText(/how it works/i)).toBeInTheDocument();
    });

    it('should show step 1: enter URL', () => {
      render(<LandingPage />);
      expect(screen.getByText(/enter your url/i)).toBeInTheDocument();
    });

    it('should show step 2: AI generates content', () => {
      render(<LandingPage />);
      expect(screen.getByText(/generate content/i)).toBeInTheDocument();
    });

    it('should show step 3: export and submit', () => {
      render(<LandingPage />);
      expect(screen.getByText(/export & submit/i)).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should render the footer with copyright', () => {
      render(<LandingPage />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<LandingPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('should have accessible navigation', () => {
      render(<LandingPage />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should have accessible main content area', () => {
      render(<LandingPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Responsiveness', () => {
    it('should render with responsive container classes', () => {
      const { container } = render(<LandingPage />);
      // Check for container or max-w classes
      expect(
        container.querySelector('[class*="max-w"]') ||
          container.querySelector('[class*="container"]')
      ).toBeInTheDocument();
    });
  });

  describe('CTA Section', () => {
    it('should have a call-to-action section', () => {
      render(<LandingPage />);
      expect(screen.getByText(/ready to submit your app/i)).toBeInTheDocument();
    });

    it('should have a secondary CTA button', () => {
      render(<LandingPage />);
      const startButton = screen.getByRole('link', { name: /start your submission/i });
      expect(startButton).toBeInTheDocument();
      expect(startButton).toHaveAttribute('href', '/dashboard');
    });
  });
});
