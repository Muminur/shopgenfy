/**
 * Performance monitoring utilities for Web Vitals tracking
 */

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender';
}

/**
 * Thresholds for Web Vitals metrics (based on Google's recommendations)
 */
const VITALS_THRESHOLDS = {
  // Cumulative Layout Shift
  CLS: { good: 0.1, poor: 0.25 },
  // First Input Delay (deprecated, use INP)
  FID: { good: 100, poor: 300 },
  // First Contentful Paint
  FCP: { good: 1800, poor: 3000 },
  // Largest Contentful Paint
  LCP: { good: 2500, poor: 4000 },
  // Time to First Byte
  TTFB: { good: 800, poor: 1800 },
  // Interaction to Next Paint
  INP: { good: 200, poor: 500 },
};

/**
 * Determine rating based on metric value and thresholds
 */
export function getRating(
  metricName: WebVitalsMetric['name'],
  value: number
): WebVitalsMetric['rating'] {
  const thresholds = VITALS_THRESHOLDS[metricName];

  if (value <= thresholds.good) {
    return 'good';
  }

  if (value <= thresholds.poor) {
    return 'needs-improvement';
  }

  return 'poor';
}

/**
 * Log Web Vitals metric to console (dev) or analytics service (prod)
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  const { name, value, rating, id } = metric;

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

    // eslint-disable-next-line no-console
    console.log(`${emoji} ${name}:`, {
      value: `${value.toFixed(2)}${name === 'CLS' ? '' : 'ms'}`,
      rating,
      id,
    });
  }

  // In production, send to analytics
  if (process.env.NODE_ENV === 'production') {
    sendToAnalytics(metric);
  }
}

/**
 * Send metrics to analytics service
 * Placeholder for future analytics integration (Google Analytics, Vercel Analytics, etc.)
 */
function sendToAnalytics(metric: WebVitalsMetric): void {
  // Example: Send to Google Analytics 4
  if (typeof window !== 'undefined' && 'gtag' in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtag = (window as any).gtag;

    gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_rating: metric.rating,
      metric_delta: metric.delta,
      metric_id: metric.id,
    });
  }

  // Example: Send to Vercel Analytics
  if (typeof window !== 'undefined' && 'va' in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const va = (window as any).va;

    va('event', {
      name: 'web-vitals',
      data: {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
      },
    });
  }

  // You can also send to custom endpoint
  // navigator.sendBeacon('/api/analytics/web-vitals', JSON.stringify(metric));
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Report when page is about to be hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Send any pending analytics
      // eslint-disable-next-line no-console
      console.log('[Performance] Page hidden, sending pending metrics');
    }
  });
}
