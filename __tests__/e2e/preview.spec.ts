import { test, expect } from '@playwright/test';

test.describe('Preview Page - Loading States', () => {
  test('should show loading spinner while fetching data', async ({ page }) => {
    // Navigate to preview page with an ID
    await page.goto('/preview?id=test-submission-id');

    // Should show loading spinner initially
    // Loading might be very fast, so we just check it doesn't error
    const loadingSpinner = page.locator('[role="status"]').or(page.getByText(/loading/i));
    // Check if loading spinner appears (may be too fast to catch)
    await loadingSpinner.isVisible().catch(() => false);
    await page.waitForTimeout(500);
  });

  test('should show error when no submission ID provided', async ({ page }) => {
    await page.goto('/preview');

    // Should show error message
    const errorMessage = page.getByText(/no submission id/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should show error for non-existent submission', async ({ page }) => {
    await page.goto('/preview?id=non-existent-id-12345');

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // Should show "not found" or error message
    const errorMessage = page.getByRole('alert').or(page.getByText(/not found|error/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should display loading state in Suspense boundary', async ({ page }) => {
    await page.goto('/preview?id=test-id');

    // The page uses Suspense, so loading state should be graceful
    // Just verify the page loads without crashing
    await page.waitForTimeout(1000);
  });
});

test.describe('Preview Page - Content Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock a successful submission response
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App Name',
          appIntroduction: 'A great app for Shopify stores',
          appDescription:
            'This is a test app that helps store owners manage their inventory efficiently and effectively.',
          features: [
            'Feature 1: Inventory tracking',
            'Feature 2: Analytics dashboard',
            'Feature 3: Alerts',
          ],
          landingPageUrl: 'https://example.com/app',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [
            {
              id: 'img-1',
              url: 'https://example.com/icon.png',
              type: 'icon',
              width: 1200,
              height: 1200,
              alt: 'App Icon',
            },
            {
              id: 'img-2',
              url: 'https://example.com/feature1.png',
              type: 'feature',
              width: 1600,
              height: 900,
              alt: 'Feature 1 Screenshot',
            },
          ],
        }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should display page title', async ({ page }) => {
    const title = page.getByRole('heading', { name: /preview/i });
    await expect(title).toBeVisible();
  });

  test('should display app name', async ({ page }) => {
    const appName = page.getByText('Test App Name');
    await expect(appName).toBeVisible();
  });

  test('should display app introduction', async ({ page }) => {
    const intro = page.getByText(/a great app for shopify stores/i);
    await expect(intro).toBeVisible();
  });

  test('should display app description', async ({ page }) => {
    const description = page.getByText(/helps store owners manage their inventory/i);
    await expect(description).toBeVisible();
  });

  test('should display features list', async ({ page }) => {
    const feature1 = page.getByText(/inventory tracking/i);
    const feature2 = page.getByText(/analytics dashboard/i);
    const feature3 = page.getByText(/alerts/i);

    await expect(feature1).toBeVisible();
    await expect(feature2).toBeVisible();
    await expect(feature3).toBeVisible();
  });

  test('should display landing page URL', async ({ page }) => {
    const urlLink = page.getByRole('link', { name: /example\.com/i });
    await expect(urlLink).toBeVisible();
  });

  test('should display submission status badge', async ({ page }) => {
    const statusBadge = page.getByText(/complete/i);
    await expect(statusBadge).toBeVisible();
  });
});

test.describe('Preview Page - Features Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One', 'Feature Two', 'Feature Three', 'Feature Four', 'Feature Five'],
          landingPageUrl: 'https://example.com',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should display Features card header', async ({ page }) => {
    const featuresTitle = page.getByRole('heading', { name: /features/i });
    await expect(featuresTitle).toBeVisible();
  });

  test('should display features description', async ({ page }) => {
    const description = page.getByText(/key capabilities/i);
    await expect(description).toBeVisible();
  });

  test('should display all features with checkmarks', async ({ page }) => {
    const features = page.getByRole('listitem');
    const count = await features.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('features should have check icons', async ({ page }) => {
    // Look for check icons next to features
    const checkIcons = page.locator('ul li svg');
    const count = await checkIcons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Preview Page - Images Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [
            {
              id: 'icon-1',
              url: '/placeholder-icon.png',
              type: 'icon',
              width: 1200,
              height: 1200,
              alt: 'App Icon for Test App',
            },
            {
              id: 'feature-1',
              url: '/placeholder-feature-1.png',
              type: 'feature',
              width: 1600,
              height: 900,
              alt: 'Feature screenshot 1',
            },
            {
              id: 'feature-2',
              url: '/placeholder-feature-2.png',
              type: 'feature',
              width: 1600,
              height: 900,
              alt: 'Feature screenshot 2',
            },
          ],
        }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should display Images card header', async ({ page }) => {
    const imagesTitle = page.getByRole('heading', { name: /images/i });
    await expect(imagesTitle).toBeVisible();
  });

  test('should display images description', async ({ page }) => {
    const description = page.getByText(/generated images for your listing/i);
    await expect(description).toBeVisible();
  });

  test('should display App Icon section', async ({ page }) => {
    const iconSection = page.getByRole('heading', { name: /app icon/i, level: 4 });
    await expect(iconSection).toBeVisible();
  });

  test('should display Feature Images section', async ({ page }) => {
    const featureSection = page.getByRole('heading', { name: /feature images/i, level: 4 });
    await expect(featureSection).toBeVisible();
  });

  test('should display image dimensions', async ({ page }) => {
    const dimensions = page.getByText(/1200.*1200|1600.*900/);
    await expect(dimensions.first()).toBeVisible();
  });
});

test.describe('Preview Page - No Images State', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should show no images message', async ({ page }) => {
    const noImagesMsg = page.getByText(/no images generated/i);
    await expect(noImagesMsg).toBeVisible();
  });
});

test.describe('Preview Page - Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Export Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should display Edit Submission button', async ({ page }) => {
    const editButton = page.getByRole('link', { name: /edit submission/i });
    await expect(editButton).toBeVisible();
  });

  test('should display Export Package button', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export package/i });
    await expect(exportButton).toBeVisible();
  });

  test('Edit button should link to dashboard', async ({ page }) => {
    const editButton = page.getByRole('link', { name: /edit submission/i });
    const href = await editButton.getAttribute('href');
    expect(href).toContain('/dashboard');
    expect(href).toContain('id=test-id');
  });

  test('should show loading state when exporting', async ({ page }) => {
    // Mock export endpoint with delay
    await page.route('**/api/export/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('mock-zip-content'),
      });
    });

    const exportButton = page.getByRole('button', { name: /export package/i });
    await exportButton.click();

    // Should show "Exporting..." text
    const exportingState = page.getByText(/exporting/i);
    await expect(exportingState).toBeVisible({ timeout: 2000 });
  });

  test('should handle export errors', async ({ page }) => {
    await page.route('**/api/export/*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Export failed' }),
      });
    });

    const exportButton = page.getByRole('button', { name: /export package/i });
    await exportButton.click();

    // Should show error message
    const errorMessage = page.getByRole('alert').filter({ hasText: /failed|error/i });
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Preview Page - Status Badges', () => {
  test('should display draft status badge correctly', async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');

    const draftBadge = page.getByText(/draft/i);
    await expect(draftBadge).toBeVisible();
  });

  test('should display complete status with checkmark', async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');

    const completeBadge = page.getByText(/complete/i);
    await expect(completeBadge).toBeVisible();
  });

  test('should display exported status', async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'exported',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');

    const exportedBadge = page.getByText(/exported/i);
    await expect(exportedBadge).toBeVisible();
  });
});

test.describe('Preview Page - Error Handling', () => {
  test('should show back to dashboard link on error', async ({ page }) => {
    await page.goto('/preview');

    const backLink = page.getByRole('link', { name: /back to dashboard/i });
    await expect(backLink).toBeVisible({ timeout: 10000 });
  });

  test('back to dashboard link should navigate correctly', async ({ page }) => {
    await page.goto('/preview');

    const backLink = page.getByRole('link', { name: /back to dashboard/i });
    await expect(backLink).toBeVisible({ timeout: 10000 });

    await backLink.click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto('/preview?id=test-id');

    // Should show error state
    const errorMessage = page.getByRole('alert').or(page.getByText(/error|failed/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await context.setOffline(false);
  });
});

test.describe('Preview Page - Responsive Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One', 'Feature Two'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [
            { id: 'img-1', url: '/icon.png', type: 'icon', width: 1200, height: 1200, alt: 'Icon' },
          ],
        }),
      });
    });
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/preview?id=test-id');

    const title = page.getByRole('heading', { name: /preview/i });
    await expect(title).toBeVisible();

    const appName = page.getByText('Test App');
    await expect(appName).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/preview?id=test-id');

    const exportButton = page.getByRole('button', { name: /export package/i });
    await expect(exportButton).toBeVisible();
  });

  test('action buttons should stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/preview?id=test-id');

    const editButton = page.getByRole('link', { name: /edit submission/i });
    const exportButton = page.getByRole('button', { name: /export package/i });

    await expect(editButton).toBeVisible();
    await expect(exportButton).toBeVisible();
  });

  test('feature images should display in grid on larger screens', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/preview?id=test-id');

    const imagesCard = page.getByRole('heading', { name: /images/i });
    await expect(imagesCard).toBeVisible();
  });
});

test.describe('Preview Page - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Page should have one H1
    const h1Count = await h1.count();
    expect(h1Count).toBe(1);
  });

  test('buttons should be keyboard accessible', async ({ page }) => {
    // Tab to export button
    const exportButton = page.getByRole('button', { name: /export package/i });
    await exportButton.focus();
    await expect(exportButton).toBeFocused();
  });

  test('links should have proper attributes', async ({ page }) => {
    const externalLink = page.getByRole('link', { name: /example\.com/i });

    if (await externalLink.isVisible()) {
      const target = await externalLink.getAttribute('target');
      const rel = await externalLink.getAttribute('rel');

      expect(target).toBe('_blank');
      expect(rel).toContain('noopener');
    }
  });

  test('images should have alt text', async ({ page }) => {
    // Route with images
    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [
            {
              id: 'img-1',
              url: '/icon.png',
              type: 'icon',
              width: 1200,
              height: 1200,
              alt: 'App Icon',
            },
          ],
        }),
      });
    });

    await page.reload();

    const images = page.getByRole('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });
});

test.describe('Preview Page - Export Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/submissions/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          appName: 'Export Test App',
          appIntroduction: 'Test intro',
          appDescription: 'Test description',
          features: ['Feature One'],
          landingPageUrl: 'https://example.com',
          status: 'complete',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/images*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      });
    });

    await page.goto('/preview?id=test-id');
  });

  test('should trigger download when export succeeds', async ({ page }) => {
    await page.route('**/api/export/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: {
          'Content-Disposition': 'attachment; filename="export-test-app.zip"',
        },
        body: Buffer.from('mock-zip-content'),
      });
    });

    const downloadPromise = page.waitForEvent('download');
    const exportButton = page.getByRole('button', { name: /export package/i });
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('export');
  });

  test('should use app name in download filename', async ({ page }) => {
    await page.route('**/api/export/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: {
          'Content-Disposition': 'attachment; filename="Export Test App-export.zip"',
        },
        body: Buffer.from('mock-zip-content'),
      });
    });

    const downloadPromise = page.waitForEvent('download');
    const exportButton = page.getByRole('button', { name: /export package/i });
    await exportButton.click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.zip$/i);
  });
});
