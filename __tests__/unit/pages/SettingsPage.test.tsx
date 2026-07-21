import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from '@/app/settings/page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// In-memory localStorage (jsdom's Storage is unreliable in this setup — the
// runner logs a `--localstorage-file` warning and method calls throw).
const storageBacking = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => (storageBacking.has(key) ? storageBacking.get(key)! : null),
    setItem: (key: string, value: string) => {
      storageBacking.set(key, String(value));
    },
    removeItem: (key: string) => {
      storageBacking.delete(key);
    },
    clear: () => {
      storageBacking.clear();
    },
  },
});

describe('Settings Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        selectedModel: 'gemini-2.0-flash',
        theme: 'system',
        autoSave: true,
      }),
    });
  });

  describe('Layout', () => {
    it('should render the settings page title', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
      });
    });

    it('should have a main content area', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });

  describe('Model Selection', () => {
    it('should render model selection section', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText(/ai model selection/i)).toBeInTheDocument();
      });
    });

    it('should display available models', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText(/gemini flash latest/i)).toBeInTheDocument();
      });
    });
  });

  describe('Theme Settings', () => {
    it('should render theme settings section', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        // Look for the exact CardTitle text
        expect(screen.getByText('Theme & Appearance')).toBeInTheDocument();
      });
    });

    it('should have theme options', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        // Multiple elements may match due to name and description
        expect(screen.getAllByText(/light/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/dark/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/system/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Auto-save Settings', () => {
    it('should render auto-save toggle section', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        // The card title for auto-save section (CardTitle is a div, not heading)
        expect(screen.getByText('Auto-save')).toBeInTheDocument();
      });
    });

    it('should have auto-save checkbox', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /enable auto-save/i })).toBeInTheDocument();
      });
    });
  });

  describe('Screenshot Source', () => {
    it('should render the screenshot source card with website/repo/folder options', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Screenshot Source')).toBeInTheDocument();
      });
      expect(screen.getByRole('radio', { name: /website/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /repo/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /folder/i })).toBeInTheDocument();
    });

    it('should persist the chosen source via the settings PUT and localStorage', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Screenshot Source')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('radio', { name: /folder/i }));
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        const putCall = mockFetch.mock.calls.find((c) => c[1]?.method === 'PUT');
        expect(putCall).toBeTruthy();
      });

      const putCall = mockFetch.mock.calls.find((c) => c[1]?.method === 'PUT')!;
      const body = JSON.parse(putCall[1].body as string);
      expect(body.screenshotSource).toBe('folder');
      expect(localStorage.getItem('shopgenfy_screenshot_source')).toBe('folder');
    });

    it('falls back to the locally cached screenshot source when the settings fetch fails (DB down)', async () => {
      localStorage.clear();
      localStorage.setItem('shopgenfy_screenshot_source', 'repo');
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Database unavailable' }),
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Screenshot Source')).toBeInTheDocument();
      });

      // DB-down should still honor the value the user already saved locally,
      // not silently reset to the hardcoded 'website' default.
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /repo/i })).toHaveAttribute(
          'aria-checked',
          'true'
        );
      });
    });
  });

  describe('Save Button', () => {
    it('should have a save settings button', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });
});
