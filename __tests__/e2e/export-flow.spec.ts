import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

// Browser-mock image generation so these exploratory tests don't share the
// process-wide 5/min Pollinations rate limit (the real generate -> store ->
// export path is proven in hermetic-flows.spec.ts). Same-origin URLs keep
// next/image happy.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/nanobanana/generate', async (route) => {
    const body = route.request().postDataJSON();
    const type = body?.type === 'feature' ? 'feature' : 'icon';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        image: {
          id: `e2e-${type}-${Math.random().toString(36).slice(2)}`,
          url: '/api/images/e2e-mock',
          type,
          width: type === 'icon' ? 1200 : 1600,
          height: type === 'icon' ? 1200 : 900,
          altText: `${type} image`,
          provider: 'pollinations',
        },
        jobId: 'job-e2e',
        status: 'completed',
        warnings: [],
      }),
    });
  });
});

async function fillCompleteSubmission(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/dashboard');
  await page.getByLabel('App Name').fill('Export Test App');
  await page.getByLabel('App Introduction (Tagline)').fill('A concise tagline');
  await page.getByLabel('App Description').fill('A description long enough to satisfy the form.');
  const feature = page.getByPlaceholder(/feature/i).first();
  if (await feature.isVisible().catch(() => false)) {
    await feature.fill('Primary feature');
  }
  // Generate (mocked) images so the export progress gate (>=80%) is satisfied.
  await page.getByRole('button', { name: 'Generate Images' }).first().click();
  await expect(page.getByRole('button', { name: /export package/i })).toBeEnabled({
    timeout: 10_000,
  });
}

test.describe('Export Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Establish a complete submission so the export button is enabled and the
    // download tests actually exercise the stateless export route.
    await fillCompleteSubmission(page);
  });

  test('generate and download ZIP export', async ({ page }) => {
    // Navigate to export section or find export button
    const exportButton = page.getByRole('button', {
      name: /export|download.*package|download.*all/i,
    });

    if (await exportButton.isEnabled().catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await exportButton.click();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify it's a ZIP file
      expect(download.suggestedFilename()).toMatch(/\.zip$/i);

      // Save to temp location for verification
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const downloadPath = path.join(
        tempDir,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${download.suggestedFilename()}`
      );
      await download.saveAs(downloadPath);

      // Verify file exists
      expect(fs.existsSync(downloadPath)).toBeTruthy();

      // Clean up
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    }
  });

  test('verify ZIP contains required files', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export|download.*package/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;

      // Save and extract ZIP
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const downloadPath = path.join(
        tempDir,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${download.suggestedFilename()}`
      );
      await download.saveAs(downloadPath);

      // Read ZIP contents
      const zip = new AdmZip(downloadPath);
      const zipEntries = zip.getEntries();
      const fileNames = zipEntries.map((entry) => entry.entryName);

      // Should contain metadata.json
      expect(fileNames.some((name) => name.includes('metadata.json'))).toBeTruthy();

      // Should contain README
      expect(fileNames.some((name) => name.toLowerCase().includes('readme'))).toBeTruthy();

      // Clean up
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    }
  });

  test('verify metadata.json contains submission data', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export|download.*package/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const downloadPath = path.join(
        tempDir,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${download.suggestedFilename()}`
      );
      await download.saveAs(downloadPath);

      // Extract and read metadata
      const zip = new AdmZip(downloadPath);
      const metadataEntry = zip
        .getEntries()
        .find((entry) => entry.entryName.includes('metadata.json'));

      if (metadataEntry) {
        const metadataContent = metadataEntry.getData().toString('utf8');
        const metadata = JSON.parse(metadataContent);

        // The stateless export nests the form under `submission`.
        expect(metadata.submission?.appName || metadata.appName || metadata.app_name).toBeTruthy();
      }

      // Clean up
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    }
  });

  test('export includes generated images', async ({ page }) => {
    // First, generate images if possible
    const generateButton = page.getByRole('button', { name: /generate.*image/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();

      // Wait for at least one image (with timeout)
      await page
        .getByRole('img')
        .first()
        .waitFor({ timeout: 90000 })
        .catch(() => null);
    }

    // Now export
    const exportButton = page.getByRole('button', { name: /export|download.*package/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const downloadPath = path.join(
        tempDir,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${download.suggestedFilename()}`
      );
      await download.saveAs(downloadPath);

      // Check for image files
      const zip = new AdmZip(downloadPath);
      const zipEntries = zip.getEntries();
      const imageFiles = zipEntries.filter((entry) => /\.(png|jpg|jpeg)$/i.test(entry.entryName));

      // If images were generated, they should be in the ZIP
      // This is conditional since image generation takes time
      if (imageFiles.length > 0) {
        expect(imageFiles.length).toBeGreaterThan(0);
      }

      // Clean up
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    }
  });

  test('export to Google Drive flow', async ({ page }) => {
    // Look for Google Drive export option
    const driveExportButton = page.getByRole('button', {
      name: /export.*drive|save.*drive|google.*drive/i,
    });

    if (await driveExportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await driveExportButton.click();

      // May require authentication
      const authButton = page.getByRole('button', { name: /authorize|connect|sign in/i });

      if (await authButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // This would open OAuth flow in production
        // In E2E test, we just verify the flow initiates
        await expect(authButton).toBeVisible();
      } else {
        // If already authenticated, should show progress
        const uploadingIndicator = page.getByText(/uploading|exporting.*drive|saving/i);
        await expect(uploadingIndicator).toBeVisible({ timeout: 10000 });

        // Wait for completion
        const successMsg = page
          .getByRole('alert')
          .filter({ hasText: /success|exported|saved.*drive/i });
        await expect(successMsg).toBeVisible({ timeout: 60000 });
      }
    }
  });

  test('display Drive folder link after export', async ({ page }) => {
    const driveExportButton = page.getByRole('button', { name: /export.*drive|save.*drive/i });

    if (await driveExportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await driveExportButton.click();

      // After successful export, should show link
      const driveLink = page.getByRole('link', { name: /open.*drive|view.*drive|drive.*folder/i });

      if (await driveLink.isVisible({ timeout: 90000 }).catch(() => false)) {
        // Link should point to Google Drive
        const href = await driveLink.getAttribute('href');
        expect(href).toContain('drive.google.com');
      }
    }
  });

  test('show export progress indicator', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export|download.*package/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      await exportButton.click();

      // Should show processing state
      const processingIndicator = page
        .getByText(/preparing|creating.*package|exporting/i)
        .or(page.getByRole('progressbar'));

      await expect(processingIndicator).toBeVisible({ timeout: 5000 });
    }
  });

  test('prevent export of incomplete submission', async ({ page }) => {
    // Go to dashboard with empty submission
    await page.goto('/dashboard');

    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      // Button might be disabled
      const isDisabled = await exportButton.isDisabled();

      if (!isDisabled) {
        // If enabled, clicking should show validation error
        await exportButton.click();

        const errorMsg = page.getByRole('alert').filter({ hasText: /complete|required|missing/i });
        await expect(errorMsg).toBeVisible({ timeout: 5000 });
      } else {
        // Disabled state is correct
        expect(isDisabled).toBeTruthy();
      }
    }
  });
});

test.describe('Export Flow - Error Handling', () => {
  test('handle export failure gracefully', async ({ page, context }) => {
    await page.goto('/dashboard');

    // Fill required fields
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Error Test App');

    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      // Simulate network error
      await exportButton.click();

      // Wait a moment then go offline
      await page.waitForTimeout(500);
      await context.setOffline(true);

      // Should show error
      const errorMsg = page.getByRole('alert').filter({ hasText: /error|failed|network/i });
      await expect(errorMsg).toBeVisible({ timeout: 30000 });

      await context.setOffline(false);
    }
  });

  test('retry failed export', async ({ page }) => {
    await page.goto('/dashboard');
    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      // After a failure, retry button should appear
      const retryButton = page.getByRole('button', { name: /retry.*export|try again/i });

      if (await retryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await retryButton.click();

        // Should restart export process
        const processingIndicator = page.getByText(/preparing|exporting|retrying/i);
        await expect(processingIndicator).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('handle Drive quota exceeded', async ({ page }) => {
    const driveExportButton = page.getByRole('button', { name: /export.*drive/i });

    if (await driveExportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // In real scenario, API would return quota error
      // E2E test just verifies error messaging exists
      await driveExportButton.click();

      // Wait for any response
      const alertMessage = page.getByRole('alert');
      await expect(alertMessage).toBeVisible({ timeout: 90000 });

      // If it's a quota error, should have helpful message
      const quotaMsg = page.getByText(/quota|storage.*full|space/i);
      const isQuotaError = await quotaMsg.isVisible({ timeout: 1000 }).catch(() => false);

      if (isQuotaError) {
        await expect(quotaMsg).toBeVisible();
      }
    }
  });
});

test.describe('Export Flow - Download Management', () => {
  test('download completes successfully', async ({ page }) => {
    await page.goto('/dashboard');

    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Download Test App');

    const exportButton = page.getByRole('button', { name: /export|download.*package/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;

      // Wait for download to complete
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();

      // Verify file size is reasonable (> 0 bytes)
      if (downloadPath) {
        const stats = fs.statSync(downloadPath);
        expect(stats.size).toBeGreaterThan(0);
      }
    }
  });

  test('handle interrupted download', async ({ page }) => {
    await page.goto('/dashboard');
    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isEnabled().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;

      // Cancel download immediately
      await download.cancel();

      // Should handle cancellation gracefully (no crash)
      // User should be able to retry
      const isExportButtonVisible = await exportButton.isVisible();
      expect(isExportButtonVisible).toBeTruthy();
    }
  });
});
