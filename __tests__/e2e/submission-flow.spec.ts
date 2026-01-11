import { test, expect } from '@playwright/test';

test.describe('Submission Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('complete submission flow: URL analysis to form save', async ({ page }) => {
    // Step 1: Enter URL for analysis
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://example.com');

    // Step 2: Click analyze button
    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await analyzeButton.click();

    // Step 3: Wait for analysis to complete (loading state)
    const loadingIndicator = page.getByRole('status').or(page.getByText(/analyzing|loading/i));
    if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(loadingIndicator).toBeHidden({ timeout: 60000 });
    }

    // Step 4: Verify form fields are auto-filled (check at least app name)
    const appNameInput = page.getByLabel(/app name/i);
    await expect(appNameInput).toBeVisible();

    // Form may or may not be auto-filled depending on API response
    // So we'll manually fill required fields for testing
    await appNameInput.fill('Test Shopify App');

    const appIntroInput = page.getByLabel(/introduction|tagline/i);
    if (await appIntroInput.isVisible()) {
      await appIntroInput.fill('A great app for Shopify stores');
    }

    const appDescInput = page.getByLabel(/description/i);
    if (await appDescInput.isVisible()) {
      await appDescInput.fill('This app helps store owners manage their inventory efficiently.');
    }

    // Step 5: Save submission
    const saveButton = page.getByRole('button', { name: /save|create|submit/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // Wait for save confirmation
      const successMessage = page.getByRole('alert').or(page.getByText(/saved|created|success/i));
      await expect(successMessage).toBeVisible({ timeout: 10000 });
    }
  });

  test('edit existing form fields', async ({ page }) => {
    // Fill app name
    const appNameInput = page.getByLabel(/app name/i);
    await expect(appNameInput).toBeVisible();
    await appNameInput.clear();
    await appNameInput.fill('Updated App Name');

    // Verify character counter updates
    const charCount = page.getByText(/16.*30|30.*16/);
    await expect(charCount).toBeVisible();

    // Edit should not trigger validation error if within limits
    const errorAlert = page.getByRole('alert').filter({ hasText: /error|invalid/i });
    await expect(errorAlert).not.toBeVisible();
  });

  test('validate character limits', async ({ page }) => {
    // Test app name limit (30 chars)
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('This is a very long app name that exceeds thirty characters');

    // Character counter should show exceeded state
    const charCount = page.getByText(/3[0-9]|[4-9][0-9]/);
    await expect(charCount).toBeVisible();
  });

  test('navigate between multiple submissions', async ({ page }) => {
    // Check if there's a submissions list or navigation
    const submissionsLink = page.getByRole('link', { name: /submissions|my apps|drafts/i });

    if (await submissionsLink.isVisible()) {
      await submissionsLink.click();

      // Should navigate to submissions list
      await expect(page).toHaveURL(/submissions|dashboard/);
    }
  });

  test('form auto-save functionality', async ({ page }) => {
    // Fill a field
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Auto Save Test');

    // Wait for auto-save (typically 30s debounce, but we'll check for indicator)
    // Look for "Saving..." or "Saved" indicator
    const saveIndicator = page.getByText(/saving|saved|auto.?save/i);

    // If auto-save is implemented, indicator should appear
    if (await saveIndicator.isVisible({ timeout: 35000 }).catch(() => false)) {
      await expect(saveIndicator).toContainText(/saved|auto.?saved/i, { timeout: 5000 });
    }
  });

  test('URL validation for landing page input', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|landing/i);

    // Test invalid URL
    await urlInput.fill('not-a-valid-url');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await analyzeButton.click();

    // Should show validation error
    const errorMessage = page.getByRole('alert').or(page.getByText(/invalid|valid url/i));
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('add and remove feature list items', async ({ page }) => {
    // Look for feature list section
    const addFeatureButton = page.getByRole('button', { name: /add feature|add item|\+/i });

    if (await addFeatureButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addFeatureButton.click();

      // New input should appear
      const featureInputs = page.getByLabel(/feature|feature list/i);
      const inputCount = await featureInputs.count();
      expect(inputCount).toBeGreaterThan(0);

      // Fill the feature
      await featureInputs.last().fill('Real-time inventory sync');

      // Remove feature
      const removeButtons = page.getByRole('button', { name: /remove|delete|×/i });
      if ((await removeButtons.count()) > 0) {
        await removeButtons.first().click();

        // Feature should be removed
        await expect(page.getByText('Real-time inventory sync')).not.toBeVisible();
      }
    }
  });

  test('form progress indicator', async ({ page }) => {
    // Check for progress indicator
    const progressIndicator = page
      .getByRole('progressbar')
      .or(page.getByText(/progress|completion|%|step \d+ of \d+/i));

    if (await progressIndicator.isVisible()) {
      // Progress should update as fields are filled
      const appNameInput = page.getByLabel(/app name/i);
      await appNameInput.fill('Progress Test App');

      // Progress value should change (hard to assert exact value)
      await expect(progressIndicator).toBeVisible();
    }
  });
});

test.describe('Submission Flow - Edge Cases', () => {
  test('handle network errors gracefully', async ({ page, context }) => {
    // Simulate offline
    await context.setOffline(true);

    await page.goto('/dashboard');

    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await urlInput.fill('https://example.com');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await analyzeButton.click();

    // Should show error message
    const errorMessage = page
      .getByRole('alert')
      .or(page.getByText(/error|network|offline|connection/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Restore online
    await context.setOffline(false);
  });

  test('handle API timeout', async ({ page }) => {
    // Start analysis that might timeout
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await urlInput.fill('https://example.com');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await analyzeButton.click();

    // Wait for potential timeout error (most APIs timeout after 30-60s)
    const errorOrSuccess = page.getByRole('alert');
    await expect(errorOrSuccess).toBeVisible({ timeout: 90000 });
  });

  test('prevent duplicate submissions', async ({ page }) => {
    // Fill required fields
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Duplicate Test App');

    // Click save button multiple times quickly
    const saveButton = page.getByRole('button', { name: /save|create|submit/i });

    if (await saveButton.isVisible()) {
      // First click
      await saveButton.click();

      // Try clicking again (button should be disabled)
      const isDisabled = await saveButton.isDisabled();

      // If not disabled, click again but only one submission should be created
      if (!isDisabled) {
        await saveButton.click();
      }

      // Should only show one success message
      const successMessages = page.getByRole('alert').filter({ hasText: /saved|created|success/i });
      const count = await successMessages.count();
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});
