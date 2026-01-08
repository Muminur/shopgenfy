import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock usePathname hook
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// We'll test the components after creating them
describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Component', () => {
    it('should render the app logo/title', async () => {
      const { Header } = await import('@/components/layout/Header');
      render(<Header />);

      expect(screen.getByText(/shopgenfy/i)).toBeInTheDocument();
    });

    it('should render navigation links', async () => {
      const { Header } = await import('@/components/layout/Header');
      render(<Header />);

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    });

    it('should highlight active navigation link', async () => {
      const { usePathname } = await import('next/navigation');
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/dashboard');

      const { Header } = await import('@/components/layout/Header');
      render(<Header />);

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });

    it('should have responsive menu toggle on mobile', async () => {
      const { Header } = await import('@/components/layout/Header');
      render(<Header />);

      // Menu toggle button should exist for mobile
      const menuButton = screen.queryByRole('button', { name: /menu/i });
      // This is only visible on mobile, so we check it exists in the DOM
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('Sidebar Component', () => {
    it('should render navigation items', async () => {
      const { Sidebar } = await import('@/components/layout/Sidebar');
      render(<Sidebar isOpen={true} onClose={() => {}} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    });

    it('should highlight current page in sidebar', async () => {
      const { usePathname } = await import('next/navigation');
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/settings');

      const { Sidebar } = await import('@/components/layout/Sidebar');
      render(<Sidebar isOpen={true} onClose={() => {}} />);

      const settingsLink = screen.getByRole('link', { name: /settings/i });
      expect(settingsLink).toHaveAttribute('aria-current', 'page');
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      const { Sidebar } = await import('@/components/layout/Sidebar');
      render(<Sidebar isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not render when closed', async () => {
      const { Sidebar } = await import('@/components/layout/Sidebar');
      const { container } = render(<Sidebar isOpen={false} onClose={() => {}} />);

      const sidebar = container.querySelector('[data-sidebar]');
      expect(sidebar).toHaveAttribute('data-state', 'closed');
    });

    it('should render when open', async () => {
      const { Sidebar } = await import('@/components/layout/Sidebar');
      const { container } = render(<Sidebar isOpen={true} onClose={() => {}} />);

      const sidebar = container.querySelector('[data-sidebar]');
      expect(sidebar).toHaveAttribute('data-state', 'open');
    });
  });

  describe('Footer Component', () => {
    it('should render copyright notice', async () => {
      const { Footer } = await import('@/components/layout/Footer');
      render(<Footer />);

      expect(screen.getByText(/shopgenfy/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument();
    });

    it('should render relevant links', async () => {
      const { Footer } = await import('@/components/layout/Footer');
      render(<Footer />);

      // Footer should have some useful links
      expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /terms/i })).toBeInTheDocument();
    });
  });

  describe('MainLayout Component', () => {
    it('should render header, sidebar, main content, and footer', async () => {
      const { MainLayout } = await import('@/components/layout/MainLayout');
      render(
        <MainLayout>
          <div data-testid="content">Test Content</div>
        </MainLayout>
      );

      // Check all sections exist
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      // Multiple navigation elements exist (header nav and sidebar nav)
      expect(screen.getAllByRole('navigation').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('main')).toBeInTheDocument(); // main content
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });

    it('should render children in main content area', async () => {
      const { MainLayout } = await import('@/components/layout/MainLayout');
      render(
        <MainLayout>
          <div data-testid="content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should toggle sidebar on menu button click', async () => {
      const { MainLayout } = await import('@/components/layout/MainLayout');
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const menuButton = screen.getByRole('button', { name: /menu/i });
      const sidebar = container.querySelector('[data-sidebar]');

      // Sidebar starts closed on mobile
      expect(sidebar).toHaveAttribute('data-state', 'closed');

      // Click to open
      fireEvent.click(menuButton);
      expect(sidebar).toHaveAttribute('data-state', 'open');

      // Click to close
      fireEvent.click(menuButton);
      expect(sidebar).toHaveAttribute('data-state', 'closed');
    });

    it('should have skip link for accessibility', async () => {
      const { MainLayout } = await import('@/components/layout/MainLayout');
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const skipLink = screen.getByText(/skip to (main )?content/i);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });
});
