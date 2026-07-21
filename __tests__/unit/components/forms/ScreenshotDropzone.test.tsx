import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenshotDropzone } from '@/components/forms/ScreenshotDropzone';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function storedImage(id: string) {
  return {
    id,
    url: `/api/images/${id}`,
    width: 1600,
    height: 900,
    type: 'feature' as const,
    altText: 'Uploaded screenshot',
    provider: 'upload' as const,
    createdAt: Date.now(),
  };
}

describe('ScreenshotDropzone', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ image: storedImage('a') }) });
  });

  it('renders a labelled file input', () => {
    render(<ScreenshotDropzone onUploaded={vi.fn()} />);
    expect(screen.getByLabelText(/upload screenshots/i)).toBeInTheDocument();
  });

  it('uploads each selected image to /api/screenshots/upload and calls onUploaded', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ image: storedImage('a') }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ image: storedImage('b') }) });

    render(<ScreenshotDropzone onUploaded={onUploaded} />);

    const input = screen.getByLabelText(/upload screenshots/i);
    const f1 = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const f2 = new File([new Uint8Array([4, 5, 6])], 'b.png', { type: 'image/png' });
    await user.upload(input, [f1, f2]);

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());

    const uploadCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/screenshots/upload');
    expect(uploadCalls).toHaveLength(2);

    // Direct-use: never touches any AI generate endpoint.
    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/generate'))).toBe(false);

    // Each request is multipart form-data carrying the file + a feature kind.
    const body = uploadCalls[0][1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeTruthy();
    expect(body.get('kind')).toBe('feature');

    // Both stored images are handed back in one call.
    expect(onUploaded.mock.calls[0][0]).toHaveLength(2);
  });

  it('does not upload non-image files (e.g. .gif is filtered out)', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    render(<ScreenshotDropzone onUploaded={onUploaded} />);

    const input = screen.getByLabelText(/upload screenshots/i);
    const gif = new File([new Uint8Array([1])], 'anim.gif', { type: 'image/gif' });
    const png = new File([new Uint8Array([2])], 'ok.png', { type: 'image/png' });
    await user.upload(input, [gif, png]);

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());

    const uploadCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/screenshots/upload');
    expect(uploadCalls).toHaveLength(1);
  });

  it('passes submissionId through on each upload when provided', async () => {
    const user = userEvent.setup();
    render(<ScreenshotDropzone onUploaded={vi.fn()} submissionId="sub-1" />);

    const input = screen.getByLabelText(/upload screenshots/i);
    await user.upload(input, new File([new Uint8Array([1])], 'ok.png', { type: 'image/png' }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find((c) => c[0] === '/api/screenshots/upload');
      expect(call).toBeTruthy();
    });

    const call = mockFetch.mock.calls.find((c) => c[0] === '/api/screenshots/upload')!;
    expect((call[1].body as FormData).get('submissionId')).toBe('sub-1');
  });

  it('surfaces an error when an upload fails', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Unsupported image type' }),
    });
    render(<ScreenshotDropzone onUploaded={vi.fn()} />);

    const input = screen.getByLabelText(/upload screenshots/i);
    await user.upload(input, new File([new Uint8Array([1])], 'ok.png', { type: 'image/png' }));

    expect(await screen.findByText(/unsupported image type/i)).toBeInTheDocument();
  });
});
