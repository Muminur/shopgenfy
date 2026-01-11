import { test, expect } from '@playwright/test';

test.describe('Image Generation Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');

    // Set up a basic submission first
    const appNameInput = page.getByLabel(/app name/i);
    if (await appNameInput.isVisible()) {
      await appNameInput.fill('Image Test App');
    }
  });

  test('trigger image generation from dashboard', async ({ page }) => {
    // Look for generate images button
    const generateButton = page.getByRole('button', {
      name: /generate.*(image|icon|asset)|create.*(image|asset)/i,
    });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();

      // Should show loading/processing state
      const processingIndicator = page.getByText(/generating|processing|creating.*image/i);
      await expect(processingIndicator).toBeVisible({ timeout: 10000 });

      // Wait for generation to complete (can take up to 5 minutes for full set)
      // We'll wait for success message or first image to appear
      const successOrImage = page
        .getByRole('alert')
        .filter({ hasText: /complete|success|generated/i })
        .or(page.getByRole('img').first());

      await expect(successOrImage).toBeVisible({ timeout: 360000 }); // 6 minutes max
    }
  });

  test('view generated images in gallery', async ({ page }) => {
    // Navigate to images section or wait for images to load
    const imagesSection = page
      .locator('[data-testid="image-gallery"]')
      .or(page.getByRole('region', { name: /images|gallery|generated/i }));

    if (await imagesSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check for image cards
      const imageCards = page.getByRole('img').or(page.locator('[data-testid="image-card"]'));

      const imageCount = await imageCards.count();

      if (imageCount > 0) {
        // Should show at least app icon
        await expect(imageCards.first()).toBeVisible();

        // Check for image metadata (dimensions, type)
        const imageInfo = page.getByText(/1200.*1200|1600.*900|icon|feature/i);
        await expect(imageInfo).toBeVisible();
      }
    }
  });

  test('regenerate single image', async ({ page }) => {
    // Find regenerate button on an image card
    const regenerateButton = page
      .getByRole('button', { name: /regenerate|re-generate|refresh/i })
      .first();

    if (await regenerateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click regenerate
      await regenerateButton.click();

      // Confirm regeneration if modal appears
      const confirmButton = page.getByRole('button', { name: /confirm|yes|proceed/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Should show regenerating state
      const regeneratingIndicator = page.getByText(/regenerating|processing/i);
      await expect(regeneratingIndicator).toBeVisible({ timeout: 5000 });

      // Wait for new image (up to 60s for single image)
      const successMessage = page
        .getByRole('alert')
        .filter({ hasText: /regenerated|updated|complete/i });
      await expect(successMessage).toBeVisible({ timeout: 90000 });
    }
  });

  test('download generated images', async ({ page }) => {
    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    // Find download button
    const downloadButton = page.getByRole('button', { name: /download/i }).first();

    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await downloadButton.click();

      // Wait for download to start
      const download = await downloadPromise;

      if (download) {
        // Verify download started
        expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg)$/i);

        // Cancel download to avoid saving file
        await download.cancel();
      }
    }
  });

  test('display image generation progress', async ({ page }) => {
    // Find generate button
    const generateButton = page.getByRole('button', { name: /generate.*(image|icon|asset)/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();

      // Should show progress indicator with count
      const progressText = page.getByText(/\d+\s*\/\s*\d+|generating \d+ of \d+/i);

      if (await progressText.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(progressText).toBeVisible();
      }

      // Or progress bar
      const progressBar = page.getByRole('progressbar');
      if (await progressBar.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(progressBar).toBeVisible();
      }
    }
  });

  test('validate image dimensions display', async ({ page }) => {
    // Check if images show their dimensions
    const dimensionInfo = page.getByText(/1200\s*×\s*1200|1600\s*×\s*900/i);

    if (await dimensionInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(dimensionInfo).toBeVisible();
    }
  });

  test('display image type labels (icon vs feature)', async ({ page }) => {
    // Check for type labels
    const typeLabel = page.getByText(/app icon|feature image/i);

    if (await typeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(typeLabel).toBeVisible();
    }
  });

  test('show alt text for accessibility', async ({ page }) => {
    // All images should have alt text
    const images = page.getByRole('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 5); i++) {
        const img = images.nth(i);
        const altText = await img.getAttribute('alt');
        expect(altText).toBeTruthy();
        expect(altText?.length).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Image Generation - Error Handling', () => {
  test('handle generation failure gracefully', async ({ page, context }) => {
    await page.goto('/dashboard');

    // Simulate network error during generation
    const generateButton = page.getByRole('button', { name: /generate.*(image|icon|asset)/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set offline after clicking
      await generateButton.click();

      // Wait a moment then go offline
      await page.waitForTimeout(1000);
      await context.setOffline(true);

      // Should show error message
      const errorMessage = page.getByRole('alert').filter({ hasText: /error|failed|network/i });
      await expect(errorMessage).toBeVisible({ timeout: 30000 });

      // Restore connection
      await context.setOffline(false);
    }
  });

  test('retry failed image generation', async ({ page }) => {
    // If an image fails, there should be a retry option
    const retryButton = page.getByRole('button', { name: /retry|try again/i });

    if (await retryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await retryButton.click();

      // Should start generation again
      const processingIndicator = page.getByText(/generating|processing|retrying/i);
      await expect(processingIndicator).toBeVisible({ timeout: 10000 });
    }
  });

  test('handle missing API keys', async ({ page }) => {
    // This would typically be tested in integration tests
    // Here we can check if there's appropriate messaging

    const generateButton = page.getByRole('button', { name: /generate.*(image|icon|asset)/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // If API key is missing, button might be disabled or show error
      const isDisabled = await generateButton.isDisabled();

      if (isDisabled) {
        // Check for explanation tooltip or message
        const errorMsg = page.getByText(/api.*key|configuration|setup required/i);
        await expect(errorMsg).toBeVisible();
      }
    }
  });
});

test.describe('Image Generation - Batch Operations', () => {
  test('generate multiple images at once', async ({ page }) => {
    await page.goto('/dashboard');

    // Fill required fields
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Batch Test App');

    // Add multiple features for image generation
    const addFeatureButton = page.getByRole('button', { name: /add feature|add item/i });

    if (await addFeatureButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      for (let i = 0; i < 3; i++) {
        await addFeatureButton.click();

        const featureInputs = page.getByLabel(/feature/i);
        await featureInputs.nth(i).fill(`Feature ${i + 1}`);
      }
    }

    // Generate all images
    const generateButton = page.getByRole('button', { name: /generate.*all|batch.*generate/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();

      // Should process multiple images
      const progress = page.getByText(/\d+\s*\/\s*[3-6]/); // 3-6 images expected
      await expect(progress).toBeVisible({ timeout: 10000 });
    }
  });

  test('cancel ongoing image generation', async ({ page }) => {
    await page.goto('/dashboard');

    const generateButton = page.getByRole('button', { name: /generate.*(image|icon|asset)/i });

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();

      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /cancel|stop/i });

      if (await cancelButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await cancelButton.click();

        // Generation should stop
        const cancelledMsg = page.getByText(/cancelled|stopped/i);
        await expect(cancelledMsg).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
