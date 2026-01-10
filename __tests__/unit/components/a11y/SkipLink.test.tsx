import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

describe('SkipLink', () => {
  it('should render skip link', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink />);

    const skipLink = screen.getByText(/skip to/i);
    expect(skipLink).toBeInTheDocument();
  });

  it('should link to main content', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink />);

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should be visually hidden by default', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink />);

    const skipLink = screen.getByText(/skip to/i);
    expect(skipLink).toHaveClass('sr-only');
  });

  it('should become visible on focus', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink />);

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    // Check that focus classes are present
    expect(skipLink).toHaveClass('focus:not-sr-only');
  });

  it('should accept custom href', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink href="#custom-main" />);

    const skipLink = screen.getByRole('link');
    expect(skipLink).toHaveAttribute('href', '#custom-main');
  });

  it('should accept custom label', async () => {
    const { SkipLink } = await import('@/components/a11y/SkipLink');
    render(<SkipLink label="Skip navigation" />);

    const skipLink = screen.getByText('Skip navigation');
    expect(skipLink).toBeInTheDocument();
  });
});
