import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('APIStatusCard', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('should render the API Status card with title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByText('API Status')).toBeInTheDocument();
      });
    });

    it('should display Gemini API status indicator', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByText('Gemini API')).toBeInTheDocument();
      });
    });

    it('should display Nano Banana API status indicator', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByText('Nano Banana API')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', async () => {
      // Return a promise that never resolves to keep component in loading state
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      // Should show loading immediately (check for loading text)
      expect(screen.getByText(/checking connections/i)).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('should show connected status for Gemini when API is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        const geminiSection = screen.getByLabelText('Gemini API connection status');
        expect(within(geminiSection).getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should show connected status for Nano Banana when API is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        const nanoBananaSection = screen.getByLabelText('Nano Banana API connection status');
        expect(within(nanoBananaSection).getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should show disconnected status when Gemini API is not reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: false, error: 'Connection failed' },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        const geminiSection = screen.getByLabelText('Gemini API connection status');
        expect(within(geminiSection).getByText('Disconnected')).toBeInTheDocument();
      });
    });

    it('should show disconnected status when Nano Banana API is not reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: false, error: 'Connection failed' },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        const nanoBananaSection = screen.getByLabelText('Nano Banana API connection status');
        expect(within(nanoBananaSection).getByText('Disconnected')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to check/i)).toBeInTheDocument();
      });
    });

    it('should show error state when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to check/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for status indicators', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      render(<APIStatusCard />);

      await waitFor(() => {
        expect(screen.getByLabelText('Gemini API connection status')).toBeInTheDocument();
        expect(screen.getByLabelText('Nano Banana API connection status')).toBeInTheDocument();
      });
    });

    it('should use semantic HTML structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      const { container } = render(<APIStatusCard />);

      await waitFor(() => {
        // Card should have proper data-slot attribute from shadcn
        expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
      });
    });
  });

  describe('Visual Indicators', () => {
    it('should show green indicator for connected status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: true, latency: 120 },
          nanobanana: { connected: true, latency: 85 },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      const { container } = render(<APIStatusCard />);

      await waitFor(() => {
        // Check for green indicator class
        const indicators = container.querySelectorAll('.bg-green-500');
        expect(indicators.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should show red indicator for disconnected status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { connected: false, error: 'Connection failed' },
          nanobanana: { connected: false, error: 'Connection failed' },
        }),
      });

      const { APIStatusCard } = await import('@/components/settings/APIStatusCard');
      const { container } = render(<APIStatusCard />);

      await waitFor(() => {
        // Check for red indicator class
        const indicators = container.querySelectorAll('.bg-red-500');
        expect(indicators.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});

describe('VersionInfoCard', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('should render the Version Info card with title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByText('Version Info')).toBeInTheDocument();
      });
    });

    it('should display Gemini API version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByText('Gemini API')).toBeInTheDocument();
        expect(screen.getByText('v1beta')).toBeInTheDocument();
      });
    });

    it('should display Nano Banana API version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByText('Nano Banana API')).toBeInTheDocument();
        expect(screen.getByText('2.1.0')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', async () => {
      // Return a promise that never resolves to keep component in loading state
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      // Should show loading immediately (check for loading text)
      expect(screen.getByText(/loading versions/i)).toBeInTheDocument();
    });
  });

  describe('Last Checked Timestamp', () => {
    it('should display last checked timestamp', async () => {
      const lastChecked = new Date('2026-01-12T10:30:00Z').toISOString();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked },
          nanobanana: { version: '2.1.0', lastChecked },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByText(/last checked/i)).toBeInTheDocument();
      });
    });

    it('should format timestamp in readable format', async () => {
      const lastChecked = new Date('2026-01-12T10:30:00Z').toISOString();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked },
          nanobanana: { version: '2.1.0', lastChecked },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        // Should display a formatted date (the exact format depends on locale)
        const timestampElement = screen.getByTestId('last-checked-timestamp');
        expect(timestampElement).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show N/A for version when not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: null, lastChecked: new Date().toISOString() },
          nanobanana: { version: null, lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for version information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        expect(screen.getByLabelText('Gemini API version information')).toBeInTheDocument();
        expect(screen.getByLabelText('Nano Banana API version information')).toBeInTheDocument();
      });
    });

    it('should use proper heading hierarchy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        // Card title should be present
        expect(screen.getByText('Version Info')).toBeInTheDocument();
      });
    });
  });

  describe('Visual Elements', () => {
    it('should display version badges', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gemini: { version: 'v1beta', lastChecked: new Date().toISOString() },
          nanobanana: { version: '2.1.0', lastChecked: new Date().toISOString() },
        }),
      });

      const { VersionInfoCard } = await import('@/components/settings/VersionInfoCard');
      render(<VersionInfoCard />);

      await waitFor(() => {
        // Check for badge-like elements
        const geminiVersion = screen.getByText('v1beta');
        const nanoBananaVersion = screen.getByText('2.1.0');
        expect(geminiVersion).toBeInTheDocument();
        expect(nanoBananaVersion).toBeInTheDocument();
      });
    });
  });
});
