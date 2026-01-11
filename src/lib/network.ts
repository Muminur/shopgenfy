/**
 * Network utilities with retry logic and offline detection
 */

import { logError } from './error-logger';

export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );

  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Determine if error is retryable
 */
function isRetryable(error: unknown, config: Required<RetryConfig>): boolean {
  if (error instanceof NetworkError) {
    return error.isRetryable;
  }

  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return config.retryableStatuses.includes(error.statusCode);
  }

  // Retry on network errors
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'TypeError' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('fetch')
  ) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check if response is ok
      if (!response.ok) {
        const shouldRetry = config.retryableStatuses.includes(response.status);

        if (shouldRetry && attempt < config.maxRetries) {
          const delay = calculateDelay(attempt, config);
          console.warn(
            `Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          shouldRetry
        );
      }

      return response;
    } catch (error: unknown) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      // Check if should retry
      if (!isRetryable(error, config)) {
        break;
      }

      const delay = calculateDelay(attempt, config);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries}):`,
        errorMessage
      );
      await sleep(delay);
    }
  }

  // Log final error
  logError(lastError!, { url, attempts: config.maxRetries + 1 }, 'medium');

  throw lastError!;
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

/**
 * Wait for network to come back online
 */
export function waitForOnline(timeout: number = 30000): Promise<boolean> {
  if (isOnline()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    const handleOnline = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
    };

    window.addEventListener('online', handleOnline);
  });
}

/**
 * Initialize network monitoring
 */
export function initNetworkMonitoring(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('online', () => {
    console.warn('Network connection restored');
  });

  window.addEventListener('offline', () => {
    console.warn('⚠️ Network connection lost');
  });
}
