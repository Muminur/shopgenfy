'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals, type WebVitalsMetric } from '@/lib/performance';

/**
 * Web Vitals tracking component
 * Integrates Next.js useReportWebVitals with custom reporting
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Transform Next.js metric to our format
    const vitalsMetric: WebVitalsMetric = {
      name: metric.name as WebVitalsMetric['name'],
      value: metric.value,
      rating: metric.rating as WebVitalsMetric['rating'],
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType as WebVitalsMetric['navigationType'],
    };

    reportWebVitals(vitalsMetric);
  });

  return null;
}
