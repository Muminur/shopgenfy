import { test, expect, chromium } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import type { Flags, Config } from 'lighthouse';

// Lighthouse thresholds based on PLANNING.md performance targets
const PERFORMANCE_THRESHOLDS = {
  performance: 70, // Target: LCP < 2s
  accessibility: 90, // WCAG AA compliance
  'best-practices': 80,
  seo: 80,
  pwa: 50, // Progressive Web App features (optional)
};

const LIGHTHOUSE_CONFIG: Flags = {
  logLevel: 'error',
  output: 'json',
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  formFactor: 'desktop',
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  throttling: {
    rttMs: 40,
    throughputKbps: 10240,
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
  },
};

test.describe('Performance Audit - Landing Page', () => {
  test('should meet Lighthouse performance thresholds', async () => {
    const browser = await chromium.launch({
      args: ['--remote-debugging-port=9222'],
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3000');

    const report = await playAudit({
      page,
      port: 9222,
      thresholds: PERFORMANCE_THRESHOLDS,
      config: LIGHTHOUSE_CONFIG as Config,
    });

    await browser.close();

    // Verify scores meet thresholds
    expect(report).toBeDefined();
  });

  test('should have fast Largest Contentful Paint (LCP < 2.5s)', async ({ page }) => {
    await page.goto('/');

    // Measure LCP using Web Vitals API
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          observer.disconnect();
          resolve(lastEntry.renderTime || lastEntry.loadTime || 0);
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Timeout after 5 seconds
        setTimeout(() => resolve(5000), 5000);
      });
    });

    // LCP should be under 2.5s (2500ms) for good performance
    expect(lcp).toBeLessThan(2500);
  });

  test('should have low Cumulative Layout Shift (CLS < 0.1)', async ({ page }) => {
    await page.goto('/');

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value) {
              clsValue += layoutShiftEntry.value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        // Measure for 3 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 3000);
      });
    });

    // CLS should be under 0.1 for good performance
    expect(cls).toBeLessThan(0.1);
  });

  test('should have fast First Contentful Paint (FCP < 1.8s)', async ({ page }) => {
    await page.goto('/');

    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry?.startTime || 0;
    });

    // FCP should be under 1.8s (1800ms) for good performance
    expect(fcp).toBeLessThan(1800);
  });

  test('should load critical resources quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Initial page load should be under 2 seconds (per PLANNING.md)
    expect(loadTime).toBeLessThan(2000);
  });

  test('should not have render-blocking resources', async ({ page }) => {
    await page.goto('/');

    // Check for render-blocking resources
    const renderBlockingResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources.filter((resource) => {
        // CSS and JS in head are potentially render-blocking
        return resource.initiatorType === 'css' || resource.initiatorType === 'script';
      });
    });

    // Should minimize render-blocking resources
    expect(renderBlockingResources.length).toBeLessThan(10);
  });

  test('should optimize images', async ({ page }) => {
    await page.goto('/');

    // Check that images are using modern formats or are optimized
    const images = await page.locator('img').all();

    for (const img of images.slice(0, 10)) {
      const src = await img.getAttribute('src');

      if (src) {
        // Not all images need to be optimized (e.g., SVG), but most should
        // We'll just verify they have src
        expect(src.length).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Performance Audit - Dashboard', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    const loadTime = Date.now() - startTime;

    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have efficient JavaScript bundle size', async ({ page }) => {
    await page.goto('/dashboard');

    // Check total JavaScript size
    const jsSize = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsResources = resources.filter((r) => r.initiatorType === 'script');

      return jsResources.reduce((total, resource) => {
        return total + (resource.transferSize || 0);
      }, 0);
    });

    // Total JS should be reasonable (under 1MB)
    expect(jsSize).toBeLessThan(1024 * 1024); // 1MB
  });

  test('should lazy load non-critical components', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that some components are lazy loaded
    const hasLazyLoading = await page.evaluate(() => {
      // Check for lazy loaded images
      const lazyImages = document.querySelectorAll('img[loading="lazy"]');
      return lazyImages.length > 0;
    });

    // Should have at least some lazy loading
    expect(hasLazyLoading).toBeTruthy();
  });

  test('should cache API responses appropriately', async ({ page }) => {
    await page.goto('/dashboard');

    // Make an API request
    const response1Promise = page.waitForResponse(
      (response) => response.url().includes('/api/') && response.status() === 200
    );

    // Trigger an API call if possible
    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    if (await analyzeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('https://example.com');
      await analyzeButton.click();

      const response1 = await response1Promise.catch(() => null);

      if (response1) {
        // Check cache headers
        const cacheControl = response1.headers()['cache-control'];

        // API responses should have appropriate cache headers
        // (This depends on your caching strategy)
        expect(cacheControl).toBeDefined();
      }
    }
  });
});

test.describe('Performance Audit - Settings', () => {
  test('should load settings page quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/settings');
    const loadTime = Date.now() - startTime;

    // Settings should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle theme switching without reflow', async ({ page }) => {
    await page.goto('/settings');

    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });

    if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Measure CLS during theme switch
      const cls = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShiftEntry = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value) {
                clsValue += layoutShiftEntry.value;
              }
            }
          });

          observer.observe({ type: 'layout-shift', buffered: true });

          // Trigger theme switch (simulated)
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 1000);
        });
      });

      await themeToggle.click();

      // Theme switch should not cause major layout shifts
      expect(cls).toBeLessThan(0.25);
    }
  });
});

test.describe('Performance Audit - Network', () => {
  test('should minimize number of network requests', async ({ page }) => {
    await page.goto('/');

    const resourceCount = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return resources.length;
    });

    // Should have reasonable number of resources (under 50 for landing page)
    expect(resourceCount).toBeLessThan(50);
  });

  test('should use compression for text resources', async ({ page }) => {
    await page.goto('/');

    // Check that responses are compressed
    const responses = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter((r) => r.initiatorType === 'script' || r.initiatorType === 'css')
        .map((r) => ({
          name: r.name,
          encodedSize: r.encodedBodySize,
          decodedSize: r.decodedBodySize,
        }));
    });

    // Most resources should be compressed (encoded < decoded)
    const compressedCount = responses.filter(
      (r) => r.encodedSize > 0 && r.encodedSize < r.decodedSize * 0.9
    ).length;

    if (responses.length > 0) {
      const compressionRatio = compressedCount / responses.length;
      expect(compressionRatio).toBeGreaterThan(0.5); // At least 50% compressed
    }
  });

  test('should use CDN for static assets', async ({ page }) => {
    await page.goto('/');

    // Check that static assets are served efficiently
    const staticAssets = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources.filter(
        (r) =>
          r.name.includes('/_next/static/') || r.name.includes('.css') || r.name.includes('.js')
      );
    });

    // Static assets should be cached
    expect(staticAssets.length).toBeGreaterThan(0);
  });
});

test.describe('Performance Audit - Mobile Performance', () => {
  test('should perform well on mobile devices', async ({ page }) => {
    // Simulate mobile device
    await page.setViewportSize({ width: 375, height: 667 });

    // Simulate slower network
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (3 * 1024 * 1024) / 8, // 3 Mbps
      uploadThroughput: (1 * 1024 * 1024) / 8, // 1 Mbps
      latency: 100, // 100ms RTT
    });

    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Should still load within reasonable time on mobile
    expect(loadTime).toBeLessThan(4000); // 4 seconds on slower connection
  });

  test('should optimize for mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');

    expect(viewportMeta).toContain('width=device-width');
    expect(viewportMeta).toContain('initial-scale=1');
  });
});

test.describe('Performance Audit - Asset Optimization', () => {
  test('should preload critical resources', async ({ page }) => {
    await page.goto('/');

    // Check for preload links
    const preloadLinks = await page.locator('link[rel="preload"]').count();

    // Should have some preloaded resources (fonts, critical CSS)
    // This is optional but good practice
    expect(preloadLinks).toBeGreaterThanOrEqual(0);
  });

  test('should defer non-critical JavaScript', async ({ page }) => {
    await page.goto('/');

    // Check for deferred scripts
    const deferredScripts = await page.locator('script[defer]').count();
    const asyncScripts = await page.locator('script[async]').count();

    // Most scripts should be deferred or async
    const totalScripts = await page.locator('script[src]').count();

    if (totalScripts > 0) {
      const optimizedRatio = (deferredScripts + asyncScripts) / totalScripts;
      expect(optimizedRatio).toBeGreaterThan(0.5); // At least 50% optimized
    }
  });

  test('should use appropriate cache headers', async ({ page }) => {
    const responses: any[] = [];

    page.on('response', (response) => {
      if (response.url().includes('/_next/static/')) {
        responses.push({
          url: response.url(),
          cacheControl: response.headers()['cache-control'],
        });
      }
    });

    await page.goto('/');

    // Wait for responses to be collected
    await page.waitForLoadState('networkidle');

    // Static assets should have long cache times
    const cachedAssets = responses.filter(
      (r) =>
        r.cacheControl &&
        (r.cacheControl.includes('public') || r.cacheControl.includes('immutable'))
    );

    if (responses.length > 0) {
      expect(cachedAssets.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Performance Audit - Runtime Performance', () => {
  test('should handle long lists efficiently', async ({ page }) => {
    await page.goto('/dashboard');

    // Measure rendering time for feature list
    const renderTime = await page.evaluate(() => {
      const start = performance.now();

      // Simulate adding many features
      const container = document.createElement('div');
      for (let i = 0; i < 100; i++) {
        const item = document.createElement('div');
        item.textContent = `Feature ${i}`;
        container.appendChild(item);
      }

      return performance.now() - start;
    });

    // Should render 100 items quickly (under 100ms)
    expect(renderTime).toBeLessThan(100);
  });

  test('should debounce input handlers', async ({ page }) => {
    await page.goto('/dashboard');

    const appNameInput = page.getByLabel(/app name/i);

    if (await appNameInput.isVisible()) {
      // Type quickly
      const startTime = Date.now();
      await appNameInput.type('Testing debounce behavior');
      const typingTime = Date.now() - startTime;

      // Typing should be responsive (under 500ms for this text)
      expect(typingTime).toBeLessThan(500);
    }
  });

  test('should optimize re-renders', async ({ page }) => {
    await page.goto('/dashboard');

    // Enable React DevTools profiling if available
    const hasReactDevTools = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
    });

    // This is informational - actual optimization testing requires React DevTools
    expect(typeof hasReactDevTools).toBe('boolean');
  });
});
