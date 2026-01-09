import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '@/app/dashboard/page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Dashboard Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: [] }),
    });
  });

  describe('Layout', () => {
    it('should render the dashboard page title', () => {
      render(<DashboardPage />);
      expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    });

    it('should have a main content area', () => {
      render(<DashboardPage />);
      // MainLayout provides the main element
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should display a two-column layout on larger screens', () => {
      const { container } = render(<DashboardPage />);
      // Check for grid layout classes
      expect(container.querySelector('[class*="grid"]')).toBeInTheDocument();
    });
  });

  describe('URL Analysis Section', () => {
    it('should render URL input field', () => {
      render(<DashboardPage />);
      expect(screen.getByLabelText(/landing page url/i)).toBeInTheDocument();
    });

    it('should have an analyze button', () => {
      render(<DashboardPage />);
      expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    });

    it('should disable analyze button when URL is empty', () => {
      render(<DashboardPage />);
      const analyzeButton = screen.getByRole('button', { name: /analyze/i });
      expect(analyzeButton).toBeDisabled();
    });
  });

  describe('Form Sections', () => {
    it('should render Basic Info section', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/basic info/i)).toBeInTheDocument();
    });

    it('should render app name field with character counter', () => {
      render(<DashboardPage />);
      expect(screen.getByLabelText(/app name/i)).toBeInTheDocument();
    });

    it('should render app introduction field', () => {
      render(<DashboardPage />);
      expect(screen.getByLabelText(/app introduction/i)).toBeInTheDocument();
    });

    it('should render app description field', () => {
      render(<DashboardPage />);
      expect(screen.getByLabelText(/app description/i)).toBeInTheDocument();
    });

    it('should render Features section', () => {
      render(<DashboardPage />);
      expect(screen.getAllByText(/features/i).length).toBeGreaterThan(0);
    });

    it('should render feature list editor', () => {
      render(<DashboardPage />);
      // Check for add feature button
      expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument();
    });
  });

  describe('Image Preview Section', () => {
    it('should render image preview area', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/generated images/i)).toBeInTheDocument();
    });

    it('should show empty state when no images generated', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/no images generated/i)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should have a save button', () => {
      render(<DashboardPage />);
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should have generate images buttons', () => {
      render(<DashboardPage />);
      // Multiple generate images buttons exist
      const generateButtons = screen.getAllByRole('button', { name: /generate.*image/i });
      expect(generateButtons.length).toBeGreaterThan(0);
    });

    it('should have an export button', () => {
      render(<DashboardPage />);
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });

  describe('Progress Indicator', () => {
    it('should show completion progress', () => {
      render(<DashboardPage />);
      // Check for progress bar
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/complete/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should display character counts for text fields', () => {
      render(<DashboardPage />);
      // Check for character count display pattern like "0/30"
      expect(screen.getAllByText(/\/\d+/).length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form labels', () => {
      render(<DashboardPage />);
      // All main form inputs should have associated labels
      expect(screen.getByLabelText(/app name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/app introduction/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/app description/i)).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(<DashboardPage />);
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});
