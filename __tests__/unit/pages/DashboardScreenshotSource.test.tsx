import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from '@/app/dashboard/page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// In-memory localStorage mock (jsdom's Storage.clear is unavailable in this
// setup); matches the pattern used by the other dashboard/hook tests.
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });

describe('Dashboard screenshot-source (folder) mode', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  it('does not render the folder dropzone by default (website source)', () => {
    render(<DashboardPage />);
    expect(screen.queryByLabelText(/upload screenshots/i)).not.toBeInTheDocument();
  });

  it('renders the screenshot dropzone when the source preference is folder', async () => {
    localStorage.setItem('shopgenfy_screenshot_source', 'folder');
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/upload screenshots/i)).toBeInTheDocument();
    });
  });

  it('adds uploaded screenshots as feature images without calling a generate endpoint', async () => {
    localStorage.setItem('shopgenfy_screenshot_source', 'folder');
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        image: {
          id: 'up1',
          url: '/api/images/up1',
          width: 1600,
          height: 900,
          type: 'feature',
          altText: 'Uploaded screenshot',
          provider: 'upload',
        },
      }),
    });

    render(<DashboardPage />);
    const input = await screen.findByLabelText(/upload screenshots/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    await user.upload(input, file);

    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c) => c[0] === '/api/screenshots/upload')).toBe(true);
    });

    // Direct-use path: never hits either AI generate endpoint.
    expect(
      mockFetch.mock.calls.some((c) => String(c[0]).includes('/api/nanobanana/generate'))
    ).toBe(false);
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/api/imagen/generate'))).toBe(
      false
    );

    // The uploaded image now populates the gallery (empty state gone).
    await waitFor(() => {
      expect(screen.queryByText(/no images generated/i)).not.toBeInTheDocument();
    });
  });
});

describe('Dashboard prompt-only compliance warning', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  it('surfaces the Imagen 4.4.4 compliance warning as a note after prompt-only generation', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.type(screen.getByLabelText(/app name/i), 'My App');
    await user.type(screen.getByLabelText(/^feature 1$/i), 'Fast sync');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        images: [
          {
            id: 'f1',
            url: '/api/images/f1',
            type: 'feature',
            width: 1600,
            height: 900,
            altText: 'Fast sync',
            provider: 'gemini',
          },
        ],
        count: 1,
        usedScreenshots: 0,
        warnings: [
          'Prompt-only feature image generated without real app screenshots; may not satisfy Shopify listing rule 4.4.4.',
        ],
      }),
    });

    await user.click(screen.getByTestId('generate-imagen-button'));

    expect(await screen.findByText(/4\.4\.4/)).toBeInTheDocument();
  });
});
