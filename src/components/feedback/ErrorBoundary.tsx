'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          role="alert"
          className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center"
        >
          <div className="mb-6 rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <AlertTriangle
              className="h-12 w-12 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Something went wrong
          </h2>

          <p className="mb-4 max-w-md text-gray-600 dark:text-gray-400">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={this.handleReset} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                Go home
              </Link>
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 max-w-2xl text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Technical details
              </summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-gray-100 p-4 text-xs text-red-600 dark:bg-gray-800 dark:text-red-400">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
