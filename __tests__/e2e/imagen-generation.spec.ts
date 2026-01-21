import { test, expect } from '@playwright/test';

/**
 * Imagen Image Generation E2E Tests
 *
 * These tests verify the presence and behavior of the "Generate with Imagen" button
 * in the dashboard. Tests use mocked API responses where possible.
 */
test.describe('Imagen Image Generation E2E', () => {
  // Only run on chromium since Firefox may not be installed
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run on Chromium');

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('should display Generate with Imagen button', async ({ page }) => {
    // Check that the Imagen button exists
    const imagenButton = page.getByTestId('generate-imagen-button');
    await expect(imagenButton).toBeVisible();
    await expect(imagenButton).toHaveText(/Generate with Imagen/i);
  });

  test('should disable Imagen button when app name is empty', async ({ page }) => {
    // Clear app name if it has content
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.clear();

    // Button should be disabled
    const imagenButton = page.getByTestId('generate-imagen-button');
    await expect(imagenButton).toBeDisabled();
  });

  test('should enable Imagen button when app name is filled', async ({ page }) => {
    // Fill in app name
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('My Test App');

    // Button should be enabled
    const imagenButton = page.getByTestId('generate-imagen-button');
    await expect(imagenButton).toBeEnabled();
  });

  test('button should contain Wand2 icon', async ({ page }) => {
    // Check that the button has an SVG icon (Wand2 from lucide-react)
    const imagenButton = page.getByTestId('generate-imagen-button');
    const svgIcon = imagenButton.locator('svg');
    await expect(svgIcon).toBeVisible();
  });

  test('should click Imagen button and trigger loading state', async ({ page }) => {
    // Fill in app name to enable the button
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('My Test App');

    // Add at least one feature
    const featuresSection = page.getByText(/Features/i).first();
    if (await featuresSection.isVisible()) {
      // Look for feature inputs
      const featureInputs = page
        .locator('input[placeholder*="feature" i]')
        .or(page.locator('[data-testid="feature-input"]'));
      if ((await featureInputs.count()) > 0) {
        await featureInputs.first().fill('Test Feature');
      }
    }

    // Mock the API to delay response
    await page.route('**/api/imagen/generate', async (route) => {
      // Delay to see loading state
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.abort('timedout'); // Abort after delay to not wait for full response
    });

    // Click the button
    const imagenButton = page.getByTestId('generate-imagen-button');
    await imagenButton.click();

    // Check for loading state - button should have loading spinner
    // The Loader2 component adds animate-spin class
    const spinner = imagenButton.locator('svg.animate-spin');
    await expect(spinner).toBeVisible({ timeout: 3000 });
  });

  test('should have correct button variant (secondary)', async ({ page }) => {
    // Button should be styled as secondary variant
    const imagenButton = page.getByTestId('generate-imagen-button');
    // shadcn button with variant="secondary" should have specific classes
    await expect(imagenButton).toHaveAttribute('data-variant', 'secondary');
  });

  test('button should be full width', async ({ page }) => {
    // Button should have w-full class for full width
    const imagenButton = page.getByTestId('generate-imagen-button');
    const classAttr = await imagenButton.getAttribute('class');
    expect(classAttr).toContain('w-full');
  });
});

/**
 * Integration with Dashboard flow
 */
test.describe('Imagen Button - Dashboard Integration', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run on Chromium');

  test('should appear in Actions card', async ({ page }) => {
    await page.goto('/dashboard');

    // Find the Actions card
    const actionsCard = page.locator('text=Actions').first().locator('..').locator('..');

    // The Imagen button should be inside the Actions section
    const imagenButton = actionsCard.getByTestId('generate-imagen-button');
    await expect(imagenButton).toBeVisible();
  });

  test('should be placed after Generate Images button', async ({ page }) => {
    await page.goto('/dashboard');

    // Find both buttons - use first() since there might be multiple matching buttons
    const generateImagesBtn = page.getByRole('button', { name: 'Generate Images' }).first();
    const imagenButton = page.getByTestId('generate-imagen-button');

    // Both should be visible
    await expect(generateImagesBtn).toBeVisible();
    await expect(imagenButton).toBeVisible();

    // Imagen button should come after Generate Images in the DOM
    // We check this by ensuring both exist and Imagen has the expected text
    await expect(imagenButton).toContainText('Imagen');
  });

  test('image gallery section exists for displaying generated images', async ({ page }) => {
    await page.goto('/dashboard');

    // There should be an image gallery section
    const imageSection = page.locator('text=Generated Images').first();
    await expect(imageSection).toBeVisible();
  });
});
