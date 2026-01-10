import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display the dashboard page', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should have URL input for landing page analysis', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await expect(urlInput).toBeVisible();
  });

  test('should have form sections', async ({ page }) => {
    // Check for app name field
    const appNameInput = page.getByLabel(/app name/i);
    await expect(appNameInput).toBeVisible();
  });

  test('should display character counts on inputs', async ({ page }) => {
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Test App');

    // Check character count is displayed
    const charCount = page.getByText(/8.*30|30.*8/);
    await expect(charCount).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /save|submit|create/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Should show validation errors
      const errorMessage = page.getByRole('alert');
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should have analyze button', async ({ page }) => {
    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await expect(analyzeButton).toBeVisible();
  });

  test('should have images section', async ({ page }) => {
    const imagesSection = page.getByText(/images|generated/i);
    await expect(imagesSection).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await expect(urlInput).toBeVisible();
  });
});
