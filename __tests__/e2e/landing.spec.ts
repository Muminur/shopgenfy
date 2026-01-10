import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the hero section with title', async ({ page }) => {
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Shopify');
  });

  test('should have a call-to-action button', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /get started|start now/i });
    await expect(ctaButton).toBeVisible();
  });

  test('should navigate to dashboard from CTA', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /get started|start now/i });
    await ctaButton.click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should display feature highlights', async ({ page }) => {
    // Check for feature section
    const features = page.locator('[data-testid="features"]');
    await expect(features).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    const dashboardLink = page.getByRole('link', { name: /dashboard/i });
    await expect(dashboardLink).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('should have proper meta tags', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('Shopgenfy');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description?.length).toBeGreaterThan(50);
  });

  test('should have skip link for accessibility', async ({ page }) => {
    // Focus on skip link by pressing Tab
    await page.keyboard.press('Tab');
    const skipLink = page.getByText(/skip to main content/i);
    await expect(skipLink).toBeVisible();
  });
});
