import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// A full GeminiAnalysisResult (same shape returned by every source path).
const analysisResult = {
  appName: 'Repo App',
  appIntroduction: 'A great app',
  appDescription: 'Does useful things for merchants',
  featureList: ['Fast sync', 'Easy setup'],
  languages: ['en'],
  primaryCategory: 'Store management',
  featureTags: [],
  pricing: { type: 'free' },
  confidence: 0.9,
  screenshots: [],
};

function findCall(url: string) {
  return mockFetch.mock.calls.find((call) => call[0] === url);
}

describe('Dashboard input-source tabs', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('renders Website URL, GitHub Repo, and Local Source tabs', () => {
    render(<DashboardPage />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /website url/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /local source/i })).toBeInTheDocument();
  });

  it('defaults to the Website URL tab and shows the landing page URL input', () => {
    render(<DashboardPage />);
    expect(screen.getByLabelText(/landing page url/i)).toBeInTheDocument();
  });

  it('shows only the active tab panel and swaps inputs when switching tabs', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    expect(screen.getByLabelText(/landing page url/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /github/i }));
    expect(screen.queryByLabelText(/landing page url/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/github repository/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /local source/i }));
    expect(screen.queryByLabelText(/github repository/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/upload/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paste/i)).toBeInTheDocument();
  });

  it('analyzes a GitHub repo via /api/gemini/analyze with sourceType "github"', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => analysisResult });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /github/i }));
    await user.type(
      screen.getByLabelText(/github repository/i),
      'https://github.com/vercel/next.js'
    );
    await user.click(screen.getByRole('button', { name: /analyze repo/i }));

    await waitFor(() => expect(findCall('/api/gemini/analyze')).toBeTruthy());
    const call = findCall('/api/gemini/analyze')!;
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({
      url: 'https://github.com/vercel/next.js',
      sourceType: 'github',
    });
  });

  it('sends sourceType "url" for the Website URL tab', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => analysisResult });

    render(<DashboardPage />);
    await user.type(screen.getByLabelText(/landing page url/i), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => expect(findCall('/api/gemini/analyze')).toBeTruthy());
    const call = findCall('/api/gemini/analyze')!;
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({ url: 'https://example.com', sourceType: 'url' });
  });

  it('analyzes pasted text via /api/analyze/source with a JSON { text } body', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => analysisResult });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /local source/i }));
    await user.type(
      screen.getByLabelText(/paste/i),
      'This is my app README with plenty of content to analyze thoroughly.'
    );
    await user.click(screen.getByRole('button', { name: /analyze source/i }));

    await waitFor(() => expect(findCall('/api/analyze/source')).toBeTruthy());
    const call = findCall('/api/analyze/source')!;
    const body = JSON.parse(call[1].body as string);
    expect(body.text).toContain('README');
  });

  it('uploads a zip file as multipart form-data to /api/analyze/source', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => analysisResult });

    render(<DashboardPage />);
    await user.click(screen.getByRole('tab', { name: /local source/i }));

    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'project.zip', {
      type: 'application/zip',
    });
    await user.upload(screen.getByLabelText(/upload/i), file);
    await user.click(screen.getByRole('button', { name: /analyze source/i }));

    await waitFor(() => expect(findCall('/api/analyze/source')).toBeTruthy());
    const call = findCall('/api/analyze/source')!;
    expect(call[1].body).toBeInstanceOf(FormData);
    expect((call[1].body as FormData).get('file')).toBeTruthy();
  });

  it('applies analysis results identically for a non-URL source (GitHub autofill)', async () => {
    const user = userEvent.setup();

    // Queue the analysis response AFTER render so the mount-time GET /api/settings
    // consumes the default mock and the analyze call gets the analysisResult.
    render(<DashboardPage />);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => analysisResult });
    await user.click(screen.getByRole('tab', { name: /github/i }));
    await user.type(
      screen.getByLabelText(/github repository/i),
      'https://github.com/vercel/next.js'
    );
    await user.click(screen.getByRole('button', { name: /analyze repo/i }));

    // The shared applyAnalysis path fills the same form fields regardless of source.
    expect(await screen.findByDisplayValue('Repo App')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A great app')).toBeInTheDocument();
  });
});
