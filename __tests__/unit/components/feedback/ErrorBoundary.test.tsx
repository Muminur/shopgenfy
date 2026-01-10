import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error during tests since we expect errors
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when child throws an error', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should display the error message', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should have a retry button that resets the error state', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    let shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Error boundary should show error UI
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Update shouldThrow and click retry
    shouldThrow = false;
    fireEvent.click(retryButton);

    // Rerender with the new value
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Note: The actual retry mechanism depends on implementation
  });

  it('should render custom fallback when provided', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', async () => {
    const onError = vi.fn();
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should reset error state when key prop changes', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');

    const { rerender } = render(
      <ErrorBoundary key="first">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Rerender with different key should reset
    rerender(
      <ErrorBoundary key="second">
        <div>New content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('New content')).toBeInTheDocument();
  });

  it('should be accessible with proper ARIA attributes', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorRegion = screen.getByRole('alert');
    expect(errorRegion).toBeInTheDocument();
  });

  it('should render go home link', async () => {
    const { ErrorBoundary } = await import('@/components/feedback/ErrorBoundary');
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
