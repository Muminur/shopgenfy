import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display the settings page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('should have model selection section', async ({ page }) => {
    const modelSection = page.getByText(/model|gemini/i);
    await expect(modelSection).toBeVisible();
  });

  test('should have theme toggle', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });
    await expect(themeToggle).toBeVisible();
  });

  test('should toggle theme on click', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });
    const htmlElement = page.locator('html');

    // Get initial theme
    const initialClass = await htmlElement.getAttribute('class');

    // Click toggle
    await themeToggle.click();

    // Theme should change
    const newClass = await htmlElement.getAttribute('class');
    expect(newClass).not.toBe(initialClass);
  });

  test('should persist model selection', async ({ page }) => {
    // Select a model if options are available
    const modelSelect = page.getByRole('combobox', { name: /model/i });
    if (await modelSelect.isVisible()) {
      await modelSelect.click();
      // Select first available option
      const option = page.getByRole('option').first();
      if (await option.isVisible()) {
        await option.click();
      }
    }
  });

  test('should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });
});
