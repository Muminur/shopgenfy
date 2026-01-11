/**
 * Error logging and tracking utility
 */

export interface ErrorContext {
  userId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface LoggedError {
  message: string;
  stack?: string;
  name: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log error to console and external service
 */
export function logError(
  error: Error,
  context: ErrorContext = {},
  severity: LoggedError['severity'] = 'medium'
): void {
  const loggedError: LoggedError = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: {
      ...context,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
    severity,
  };

  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    const emoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '❌',
      critical: '🚨',
    }[severity];

    console.error(`${emoji} [${severity.toUpperCase()}]`, error.message, loggedError);
  }

  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production') {
    sendToErrorTracking(loggedError);
  }
}

/**
 * Send error to external tracking service
 * Placeholder for Sentry, LogRocket, Bugsnag, etc.
 */
function sendToErrorTracking(loggedError: LoggedError): void {
  // Example: Sentry
  if (typeof window !== 'undefined' && 'Sentry' in window) {
    const Sentry = (
      window as Window & {
        Sentry?: {
          captureException: (error: Error, options: { level: string; extra: ErrorContext }) => void;
        };
      }
    ).Sentry;

    Sentry?.captureException(new Error(loggedError.message), {
      level: loggedError.severity,
      extra: loggedError.context,
    });
  }

  // You can also send to custom endpoint
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(
        '/api/errors',
        JSON.stringify({
          error: loggedError,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      // Fail silently if error reporting fails
      console.warn('Failed to report error:', e);
    }
  }
}

/**
 * Create a global error handler
 */
export function initErrorLogging(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Global error handler
  window.addEventListener('error', (event) => {
    logError(
      event.error || new Error(event.message),
      {
        type: 'uncaught-error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      'high'
    );
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      {
        type: 'unhandled-rejection',
      },
      'high'
    );
  });
}
