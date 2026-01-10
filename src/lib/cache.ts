/**
 * Cache duration presets in seconds
 */
export enum CacheDuration {
  FIVE_MINUTES = 300,
  FIFTEEN_MINUTES = 900,
  ONE_HOUR = 3600,
  ONE_DAY = 86400,
  ONE_WEEK = 604800,
  ONE_YEAR = 31536000,
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Cache type:
   * - public: Can be cached by browsers and CDNs
   * - private: Can only be cached by browser
   * - no-store: Should not be cached
   */
  type: 'public' | 'private' | 'no-store';

  /**
   * Cache duration in seconds
   * @default CacheDuration.FIVE_MINUTES
   */
  duration?: number;

  /**
   * Time in seconds during which stale content can be served while revalidating
   */
  staleWhileRevalidate?: number;

  /**
   * Force revalidation when cache is stale
   */
  mustRevalidate?: boolean;
}

/**
 * Generate cache control headers based on configuration
 */
export function getCacheHeaders(config: CacheConfig): Record<string, string> {
  if (config.type === 'no-store') {
    return {
      'Cache-Control': 'no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  }

  const duration = config.duration ?? CacheDuration.FIVE_MINUTES;
  const parts: string[] = [config.type];

  parts.push(`max-age=${duration}`);

  if (config.type === 'public') {
    parts.push(`s-maxage=${duration}`);

    // Add stale-while-revalidate for public caching (default 60s)
    const swr = config.staleWhileRevalidate ?? 60;
    parts.push(`stale-while-revalidate=${swr}`);
  }

  if (config.mustRevalidate || config.type === 'private') {
    parts.push('must-revalidate');
  }

  return {
    'Cache-Control': parts.join(', '),
  };
}

/**
 * Add cache headers to a Response object
 */
export function withCacheHeaders(response: Response, config: CacheConfig): Response {
  const headers = new Headers(response.headers);
  const cacheHeaders = getCacheHeaders(config);

  Object.entries(cacheHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Predefined cache configurations for common use cases
 */
export const CachePresets = {
  /**
   * No caching - for sensitive or dynamic data
   */
  NO_CACHE: { type: 'no-store' } as CacheConfig,

  /**
   * Short-lived public cache - for frequently changing data
   */
  PUBLIC_SHORT: {
    type: 'public',
    duration: CacheDuration.FIVE_MINUTES,
  } as CacheConfig,

  /**
   * Medium-lived public cache - for moderately changing data
   */
  PUBLIC_MEDIUM: {
    type: 'public',
    duration: CacheDuration.ONE_HOUR,
  } as CacheConfig,

  /**
   * Long-lived public cache - for static or rarely changing data
   */
  PUBLIC_LONG: {
    type: 'public',
    duration: CacheDuration.ONE_DAY,
  } as CacheConfig,

  /**
   * Static assets cache - for immutable content
   */
  STATIC: {
    type: 'public',
    duration: CacheDuration.ONE_YEAR,
  } as CacheConfig,

  /**
   * Private cache - for user-specific data
   */
  PRIVATE: {
    type: 'private',
    duration: CacheDuration.FIVE_MINUTES,
  } as CacheConfig,
};
