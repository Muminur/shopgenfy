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

// In-memory localStorage mock (jsdom Storage.clear is unavailable in this setup).
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

// A full analysis result carrying one harvested screenshot candidate (bytes,
// no sourceType — the dashboard tags origin by which handler received it).
function analysisWithScreenshot() {
  return {
    appName: 'Repo App',
    appIntroduction: 'A great app',
    appDescription: 'Does useful things for merchants',
    featureList: ['Fast sync', 'Easy setup'],
    languages: ['en'],
    primaryCategory: 'Store management',
    screenshots: [{ base64: 'aGVsbG8=', mimeType: 'image/png', alt: 'home screen' }],
  };
}

// URL-keyed fetch stub so the mount-time GET /api/settings never competes with
// the analyze/imagen responses (no FIFO once-queue fragility).
function routeMock(handlers: {
  settings?: () => unknown;
  settingsOk?: boolean;
  analyze?: () => unknown;
  source?: () => unknown;
  imagen?: () => unknown;
}) {
  mockFetch.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/settings')) {
      return Promise.resolve({
        ok: handlers.settingsOk ?? true,
        status: handlers.settingsOk === false ? 503 : 200,
        json: async () => (handlers.settings ? handlers.settings() : {}),
      });
    }
    if (u.includes('/api/gemini/analyze')) {
      return Promise.resolve({
        ok: true,
        json: async () => (handlers.analyze ? handlers.analyze() : {}),
      });
    }
    if (u.includes('/api/analyze/source')) {
      return Promise.resolve({
        ok: true,
        json: async () => (handlers.source ? handlers.source() : {}),
      });
    }
    if (u.includes('/api/imagen/generate')) {
      return Promise.resolve({
        ok: true,
        json: async () => (handlers.imagen ? handlers.imagen() : {}),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

const directUseButton = () => screen.queryByRole('button', { name: /use .*screenshot.*directly/i });

describe('Dashboard screenshot-source wiring — eligibility by setting', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    store.clear();
  });
  afterEach(() => {
    store.clear();
  });

  it('website setting + GitHub analysis: harvested screenshots are NOT eligible (no direct-use button)', async () => {
    const user = userEvent.setup();
    routeMock({
      settings: () => ({ screenshotSource: 'website' }),
      analyze: analysisWithScreenshot,
    });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /github/i }));
    await user.type(
      screen.getByLabelText(/github repository/i),
      'https://github.com/vercel/next.js'
    );
    await user.click(screen.getByRole('button', { name: /analyze repo/i }));

    // Analysis applied (fields filled) but the github-origin screenshot is not
    // eligible under a 'website' preference, so the direct-use CTA stays hidden.
    expect(await screen.findByDisplayValue('Repo App')).toBeInTheDocument();
    expect(directUseButton()).not.toBeInTheDocument();
  });

  it('repo setting + GitHub analysis: harvested screenshots ARE eligible (direct-use button shown)', async () => {
    const user = userEvent.setup();
    routeMock({ settings: () => ({ screenshotSource: 'repo' }), analyze: analysisWithScreenshot });

    render(<DashboardPage />);
    // Wait for the server preference ('repo') to apply before analyzing.
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/api/settings'))).toBe(true);
    });
    await user.click(screen.getByRole('tab', { name: /github/i }));
    await user.type(
      screen.getByLabelText(/github repository/i),
      'https://github.com/vercel/next.js'
    );
    await user.click(screen.getByRole('button', { name: /analyze repo/i }));

    expect(await directUseButtonAppears()).toBeInTheDocument();
  });

  it('website setting + GitHub analysis: Imagen call omits the ineligible screenshots', async () => {
    const user = userEvent.setup();
    routeMock({
      settings: () => ({ screenshotSource: 'website' }),
      analyze: analysisWithScreenshot,
      imagen: () => ({
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
        warnings: [],
      }),
    });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /github/i }));
    await user.type(
      screen.getByLabelText(/github repository/i),
      'https://github.com/vercel/next.js'
    );
    await user.click(screen.getByRole('button', { name: /analyze repo/i }));
    await screen.findByDisplayValue('Repo App');

    await user.click(screen.getByTestId('generate-imagen-button'));

    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/api/imagen/generate'))).toBe(
        true
      );
    });
    const imagenCall = mockFetch.mock.calls.find((c) =>
      String(c[0]).includes('/api/imagen/generate')
    )!;
    const body = JSON.parse(imagenCall[1].body as string);
    // github-origin screenshots are ineligible under 'website' → never sent.
    expect(body.screenshots).toBeUndefined();
  });

  it('website setting + Website analysis: url-origin screenshots ARE eligible (direct-use button shown)', async () => {
    const user = userEvent.setup();
    routeMock({
      settings: () => ({ screenshotSource: 'website' }),
      analyze: analysisWithScreenshot,
    });

    render(<DashboardPage />);
    await user.type(screen.getByLabelText(/landing page url/i), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /analyze with ai/i }));

    expect(await directUseButtonAppears()).toBeInTheDocument();
  });

  it('folder setting + Local Source analysis: source-origin screenshots ARE eligible (direct-use button shown)', async () => {
    const user = userEvent.setup();
    // Set folder locally so the synchronous read applies immediately (no need
    // to wait for the settings API to resolve before analyzing).
    localStorage.setItem('shopgenfy_screenshot_source', 'folder');
    routeMock({ settings: () => ({ screenshotSource: 'folder' }), source: analysisWithScreenshot });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /local source/i }));
    await user.type(
      screen.getByLabelText(/paste/i),
      'My app README with enough descriptive content to analyze thoroughly.'
    );
    await user.click(screen.getByRole('button', { name: /analyze source/i }));

    // A zip/paste-harvested screenshot is tagged 'source' and is eligible under
    // the 'folder' preference (your own files), so the direct-use CTA appears.
    expect(await directUseButtonAppears()).toBeInTheDocument();
  });
});

describe('Dashboard screenshot-source preference — read from API with localStorage fallback', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    store.clear();
  });
  afterEach(() => {
    store.clear();
  });

  it('applies the folder preference returned by GET /api/settings (renders the dropzone)', async () => {
    // No localStorage value; the server preference alone drives folder mode.
    routeMock({ settings: () => ({ screenshotSource: 'folder' }) });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/upload screenshots/i)).toBeInTheDocument();
    });
  });

  it('falls back to the localStorage preference when GET /api/settings fails (DB down)', async () => {
    localStorage.setItem('shopgenfy_screenshot_source', 'folder');
    routeMock({ settingsOk: false });

    render(<DashboardPage />);

    // The 503 from settings must not clear the locally-persisted folder mode.
    await waitFor(() => {
      expect(screen.getByLabelText(/upload screenshots/i)).toBeInTheDocument();
    });
  });
});

// The direct-use button is rendered asynchronously after the upload-route
// screenshots settle; wait for it to appear.
async function directUseButtonAppears() {
  return screen.findByRole('button', { name: /use .*screenshot.*directly/i });
}
