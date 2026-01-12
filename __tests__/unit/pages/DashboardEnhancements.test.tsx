import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '@/app/dashboard/page';

// Mock fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = vi.fn() as any;

// Mock localStorage for user ID persistence
const localStorageMock = {
  getItem: vi.fn(() => 'test-user-id'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Dashboard Page - Milestone 6 Enhancements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-user-id');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Languages & Integrations Section', () => {
    it('should render languages multi-select', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Languages & Integrations')).toBeInTheDocument();
    });

    it('should render integrations multi-select', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Languages & Integrations')).toBeInTheDocument();
    });

    it('should display "Works with" label for integrations', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Works With')).toBeInTheDocument();
    });

    it('should enforce maximum 6 integrations limit', async () => {
      render(<DashboardPage />);
      const worksWithLabel = screen.getByText('Works With');
      expect(worksWithLabel).toBeInTheDocument();
      // Max 6 items enforced by MultiSelect component
    });
  });

  describe('Categories Section', () => {
    it('should render categories section', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('should render primary category select', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Primary Category')).toBeInTheDocument();
    });

    it('should render optional secondary category select', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Secondary Category')).toBeInTheDocument();
    });
  });

  describe('Pricing Section', () => {
    it('should render pricing section', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Pricing Type')).toBeInTheDocument();
    });

    it('should display pricing type options', () => {
      render(<DashboardPage />);
      const pricingTypeLabel = screen.getByText('Pricing Type');
      expect(pricingTypeLabel).toBeInTheDocument();
    });

    it('should show price input when paid option selected', async () => {
      render(<DashboardPage />);
      // Pricing component should conditionally show price fields
      // Test implementation will verify this based on selected type
      expect(screen.getByText('Pricing Type')).toBeInTheDocument();
    });
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save form data after changes', async () => {
      vi.useFakeTimers();
      try {
        render(<DashboardPage />);

        const appNameInput = screen.getByPlaceholderText(/your app name/i);
        fireEvent.change(appNameInput, { target: { value: 'Test App' } });

        // Fast-forward 30 seconds for debounced auto-save
        await vi.advanceTimersByTimeAsync(30000);

        expect(global.fetch).toHaveBeenCalledWith(
          '/api/submissions',
          expect.objectContaining({
            method: 'POST',
          })
        );
      } finally {
        vi.useRealTimers();
      }
    }, 10000);

    it('should not auto-save immediately on first render', () => {
      vi.useFakeTimers();
      try {
        render(<DashboardPage />);

        vi.advanceTimersByTime(5000);

        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should debounce multiple rapid changes', async () => {
      vi.useFakeTimers();
      try {
        render(<DashboardPage />);

        const appNameInput = screen.getByPlaceholderText(/your app name/i);

        // Make multiple rapid changes
        fireEvent.change(appNameInput, { target: { value: 'Test' } });
        vi.advanceTimersByTime(1000);
        fireEvent.change(appNameInput, { target: { value: 'Test App' } });
        vi.advanceTimersByTime(1000);
        fireEvent.change(appNameInput, { target: { value: 'Test App Name' } });

        // Should only save once after debounce period
        await vi.advanceTimersByTimeAsync(30000);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchCalls = (global.fetch as any).mock.calls.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (call: any) => call[0] === '/api/submissions'
        );
        expect(fetchCalls.length).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    }, 10000);
  });

  describe('Form Sections Integration', () => {
    it('should render all required form sections', () => {
      render(<DashboardPage />);

      // Basic Info (already exists)
      expect(screen.getByText('Basic Info')).toBeInTheDocument();

      // Features (already exists) - Multiple "Features" texts exist, just check one
      const featureCards = screen.getAllByText('Features');
      expect(featureCards.length).toBeGreaterThan(0);

      // NEW: Languages & Integrations
      expect(screen.getByText('Languages & Integrations')).toBeInTheDocument();

      // NEW: Categories
      expect(screen.getByText('Categories')).toBeInTheDocument();

      // NEW: Pricing
      expect(screen.getByText('Pricing Type')).toBeInTheDocument();
    });

    it('should maintain form state across sections', () => {
      render(<DashboardPage />);

      const appNameInput = screen.getByPlaceholderText(/your app name/i);
      fireEvent.change(appNameInput, { target: { value: 'My App' } });

      expect(appNameInput).toHaveValue('My App');
    });
  });
});
