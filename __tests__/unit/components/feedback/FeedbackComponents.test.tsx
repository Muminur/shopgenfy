import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

describe('Feedback Components', () => {
  describe('LoadingSpinner', () => {
    it('should render spinner', async () => {
      const { LoadingSpinner } = await import('@/components/feedback/LoadingSpinner');
      render(<LoadingSpinner />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should show loading text when provided', async () => {
      const { LoadingSpinner } = await import('@/components/feedback/LoadingSpinner');
      render(<LoadingSpinner text="Loading..." />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should accept different sizes', async () => {
      const { LoadingSpinner } = await import('@/components/feedback/LoadingSpinner');
      const { container } = render(<LoadingSpinner size="lg" />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveClass('h-8');
    });
  });

  describe('ProgressBar', () => {
    it('should render progress bar', async () => {
      const { ProgressBar } = await import('@/components/feedback/ProgressBar');
      render(<ProgressBar value={50} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should show percentage text', async () => {
      const { ProgressBar } = await import('@/components/feedback/ProgressBar');
      render(<ProgressBar value={75} showText />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should show label when provided', async () => {
      const { ProgressBar } = await import('@/components/feedback/ProgressBar');
      render(<ProgressBar value={50} label="Processing images" />);

      expect(screen.getByText('Processing images')).toBeInTheDocument();
    });

    it('should clamp values between 0 and 100', async () => {
      const { ProgressBar } = await import('@/components/feedback/ProgressBar');
      render(<ProgressBar value={150} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('EmptyState', () => {
    it('should render empty state message', async () => {
      const { EmptyState } = await import('@/components/feedback/EmptyState');
      render(<EmptyState title="No submissions" description="Create your first submission" />);

      expect(screen.getByText('No submissions')).toBeInTheDocument();
      expect(screen.getByText('Create your first submission')).toBeInTheDocument();
    });

    it('should render action button when provided', async () => {
      const onAction = vi.fn();
      const { EmptyState } = await import('@/components/feedback/EmptyState');
      render(
        <EmptyState
          title="No submissions"
          description="Create your first submission"
          actionLabel="Create Submission"
          onAction={onAction}
        />
      );

      const button = screen.getByRole('button', { name: 'Create Submission' });
      fireEvent.click(button);

      expect(onAction).toHaveBeenCalled();
    });

    it('should render custom icon when provided', async () => {
      const { EmptyState } = await import('@/components/feedback/EmptyState');
      render(
        <EmptyState title="No images" description="Generate images for your app" icon="image" />
      );

      // Icon should be rendered
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('AlertMessage', () => {
    it('should render error alert', async () => {
      const { AlertMessage } = await import('@/components/feedback/AlertMessage');
      render(<AlertMessage variant="error" message="Something went wrong" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should render success alert', async () => {
      const { AlertMessage } = await import('@/components/feedback/AlertMessage');
      render(<AlertMessage variant="success" message="Changes saved successfully" />);

      expect(screen.getByText('Changes saved successfully')).toBeInTheDocument();
    });

    it('should render warning alert', async () => {
      const { AlertMessage } = await import('@/components/feedback/AlertMessage');
      render(<AlertMessage variant="warning" message="This action cannot be undone" />);

      expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
    });

    it('should be dismissible when onDismiss is provided', async () => {
      const onDismiss = vi.fn();
      const { AlertMessage } = await import('@/components/feedback/AlertMessage');
      render(<AlertMessage variant="info" message="New version available" onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
