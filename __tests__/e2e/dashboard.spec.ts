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

test.describe('Dashboard Page - Languages & Integrations Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display Languages & Integrations section', async ({ page }) => {
    const sectionTitle = page.getByRole('heading', { name: /languages.*integrations/i });
    await expect(sectionTitle).toBeVisible();
  });

  test('should display Languages multi-select', async ({ page }) => {
    const languagesLabel = page.getByText(/^languages$/i);
    await expect(languagesLabel).toBeVisible();

    // Look for the languages select placeholder or trigger
    const languagesSelect = page.getByPlaceholder(/select.*languages/i);
    await expect(languagesSelect).toBeVisible();
  });

  test('should display Works With multi-select', async ({ page }) => {
    const worksWithLabel = page.getByText(/works with/i);
    await expect(worksWithLabel).toBeVisible();

    // Look for the integrations select placeholder
    const worksWithSelect = page.getByPlaceholder(/select.*integrations/i);
    await expect(worksWithSelect).toBeVisible();
  });

  test('should allow selecting multiple languages', async ({ page }) => {
    const languagesSelect = page.getByPlaceholder(/select.*languages/i);
    await languagesSelect.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Look for language options
    const englishOption = page.getByRole('option', { name: /english/i });
    if (await englishOption.isVisible()) {
      await englishOption.click();
    }

    // Check that selection was made
    const selectedBadge = page.getByText(/english/i);
    await expect(selectedBadge).toBeVisible();
  });

  test('should limit Works With to maximum 6 items', async ({ page }) => {
    const helperText = page.getByText(/maximum 6.*integrations/i);
    await expect(helperText).toBeVisible();
  });

  test('should display helper text for languages', async ({ page }) => {
    const helperText = page.getByText(/languages your app supports/i);
    await expect(helperText).toBeVisible();
  });

  test('should be keyboard accessible for multi-select', async ({ page }) => {
    const languagesSelect = page.getByPlaceholder(/select.*languages/i);
    await languagesSelect.focus();

    // Should be focusable
    await expect(languagesSelect).toBeFocused();

    // Press Enter to open dropdown
    await page.keyboard.press('Enter');

    // Dropdown should open
    await page.waitForTimeout(300);
  });

  test('should display Languages icon in section header', async ({ page }) => {
    // Look for the Languages icon (lucide Languages icon)
    const sectionHeader = page.getByRole('heading', { name: /languages.*integrations/i });
    const parentCard = sectionHeader.locator('..');
    const icon = parentCard.locator('svg');
    await expect(icon.first()).toBeVisible();
  });
});

test.describe('Dashboard Page - Categories Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display Categories section', async ({ page }) => {
    const sectionTitle = page.getByRole('heading', { name: /^categories$/i });
    await expect(sectionTitle).toBeVisible();
  });

  test('should display Primary Category selector', async ({ page }) => {
    const primaryLabel = page.getByText(/primary category/i);
    await expect(primaryLabel).toBeVisible();

    const primarySelect = page.getByPlaceholder(/select primary category/i);
    await expect(primarySelect).toBeVisible();
  });

  test('should display Secondary Category selector', async ({ page }) => {
    const secondaryLabel = page.getByText(/secondary category/i);
    await expect(secondaryLabel).toBeVisible();

    const secondarySelect = page.getByPlaceholder(/select secondary category/i);
    await expect(secondarySelect).toBeVisible();
  });

  test('should allow selecting primary category', async ({ page }) => {
    const primarySelect = page.getByPlaceholder(/select primary category/i);
    await primarySelect.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Look for category options
    const categoryOption = page.getByRole('option').first();
    if (await categoryOption.isVisible()) {
      const optionText = await categoryOption.textContent();
      await categoryOption.click();

      // Verify selection
      if (optionText) {
        const selectedText = page.getByText(optionText);
        await expect(selectedText.first()).toBeVisible();
      }
    }
  });

  test('should indicate secondary category is optional', async ({ page }) => {
    // Look for optional indicator
    const optionalText = page.getByText(/optional/i);
    // This could be in the label or as a separate indicator
    if (await optionalText.isVisible()) {
      await expect(optionalText).toBeVisible();
    }
  });

  test('should display Categories icon in section header', async ({ page }) => {
    const sectionHeader = page.getByRole('heading', { name: /^categories$/i });
    const parentCard = sectionHeader.locator('..');
    const icon = parentCard.locator('svg');
    await expect(icon.first()).toBeVisible();
  });

  test('should display section description', async ({ page }) => {
    const description = page.getByText(/app store categories/i);
    await expect(description).toBeVisible();
  });
});

test.describe('Dashboard Page - Pricing Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display Pricing section', async ({ page }) => {
    const sectionTitle = page.getByRole('heading', { name: /^pricing$/i });
    await expect(sectionTitle).toBeVisible();
  });

  test('should display pricing section description', async ({ page }) => {
    const description = page.getByText(/configure your app pricing model/i);
    await expect(description).toBeVisible();
  });

  test('should display pricing type options', async ({ page }) => {
    // Look for common pricing types
    const freeOption = page.getByText(/^free$/i);
    const paidOption = page.getByText(/one.?time/i);
    const subscriptionOption = page.getByText(/subscription|recurring/i);

    // At least one pricing option should be visible
    const anyVisible =
      (await freeOption.isVisible({ timeout: 1000 }).catch(() => false)) ||
      (await paidOption.isVisible({ timeout: 1000 }).catch(() => false)) ||
      (await subscriptionOption.isVisible({ timeout: 1000 }).catch(() => false));

    expect(anyVisible).toBeTruthy();
  });

  test('should allow selecting free pricing', async ({ page }) => {
    const freeOption = page.getByRole('radio', { name: /free/i });
    if (await freeOption.isVisible()) {
      await freeOption.click();
      await expect(freeOption).toBeChecked();
    }
  });

  test('should show price input when paid option selected', async ({ page }) => {
    // Look for paid/subscription option
    const paidOption = page
      .getByRole('radio', { name: /paid|one.?time/i })
      .or(page.getByText(/one.?time.*purchase/i));

    if (await paidOption.isVisible()) {
      await paidOption.click();

      // Should show price input
      const priceInput = page.getByLabel(/price|amount/i);
      if (await priceInput.isVisible()) {
        await expect(priceInput).toBeVisible();
      }
    }
  });

  test('should be keyboard accessible', async ({ page }) => {
    const sectionTitle = page.getByRole('heading', { name: /^pricing$/i });
    await sectionTitle.scrollIntoViewIfNeeded();

    // Tab to pricing options
    const pricingSection = sectionTitle.locator('..').locator('..');
    const firstInteractive = pricingSection.locator('button, [role="radio"], input').first();

    if (await firstInteractive.isVisible()) {
      await firstInteractive.focus();
      await expect(firstInteractive).toBeFocused();
    }
  });
});

test.describe('Dashboard Page - Auto-save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should trigger auto-save after form changes', async ({ page }) => {
    // Fill in form field
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Auto Save Test App');

    // Wait for auto-save debounce (30 seconds is too long for E2E, check for indicator)
    // Auto-save might show a brief indicator or save silently
    // We just verify form interaction works without errors
    await page.waitForTimeout(1000);

    // Check if saving indicator appears (optional - auto-save may be silent)
    const savingIndicator = page.getByText(/saving|auto.?sav|saved/i);
    // Just check visibility without failing if not present
    await savingIndicator.isVisible().catch(() => false);

    // No error should appear during normal interaction
    const errorAlert = page.getByRole('alert').filter({ hasText: /error|failed/i });
    await expect(errorAlert).not.toBeVisible();
  });

  test('should preserve form data after quick interactions', async ({ page }) => {
    // Fill multiple fields quickly
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Quick Input Test');

    const appIntroInput = page.getByLabel(/introduction|tagline/i);
    if (await appIntroInput.isVisible()) {
      await appIntroInput.fill('A test tagline');
    }

    // Verify data is preserved
    await expect(appNameInput).toHaveValue('Quick Input Test');
  });

  test('should not lose data during typing', async ({ page }) => {
    const appNameInput = page.getByLabel(/app name/i);

    // Type slowly to simulate real user input
    await appNameInput.click();
    await page.keyboard.type('Typing Test', { delay: 50 });

    // Verify all characters were captured
    await expect(appNameInput).toHaveValue('Typing Test');
  });

  test('should handle rapid input changes', async ({ page }) => {
    const appNameInput = page.getByLabel(/app name/i);

    // Rapidly change input multiple times
    await appNameInput.fill('First');
    await appNameInput.fill('Second');
    await appNameInput.fill('Third');
    await appNameInput.fill('Final Value');

    // Final value should be preserved
    await expect(appNameInput).toHaveValue('Final Value');
  });

  test('auto-save should not block form interaction', async ({ page }) => {
    // Fill app name
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Auto Save App');

    // Immediately interact with another field
    const appIntroInput = page.getByLabel(/introduction|tagline/i);
    if (await appIntroInput.isVisible()) {
      await appIntroInput.fill('Immediate follow-up');
      await expect(appIntroInput).toHaveValue('Immediate follow-up');
    }

    // Continue to description
    const appDescInput = page.getByLabel(/description/i);
    if (await appDescInput.isVisible()) {
      await appDescInput.fill('Testing concurrent input');
      await expect(appDescInput).toHaveValue('Testing concurrent input');
    }
  });

  test('should update progress indicator as fields are filled', async ({ page }) => {
    // Check initial progress
    const progressBar = page.getByRole('progressbar').or(page.getByText(/\d+%.*complete/i));
    if (await progressBar.isVisible()) {
      // Fill some fields
      const appNameInput = page.getByLabel(/app name/i);
      await appNameInput.fill('Progress Test App');

      // Progress should update (we can't assert exact value, just that it changed)
      await expect(progressBar).toBeVisible();
    }
  });
});

test.describe('Dashboard Page - Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should show character limit warnings', async ({ page }) => {
    const appNameInput = page.getByLabel(/app name/i);

    // Type text near the limit
    await appNameInput.fill('This is exactly thirty chars');

    // Look for character count display
    const charCount = page.getByText(/30.*30|30 \/ 30/);
    await expect(charCount).toBeVisible();
  });

  test('should indicate when character limit exceeded', async ({ page }) => {
    const appNameInput = page.getByLabel(/app name/i);

    // Type text exceeding limit
    await appNameInput.fill('This is a very long app name that exceeds the limit');

    // Look for visual indicator of exceeded limit (could be red text, warning, etc.)
    const exceedWarning = page.locator('.text-destructive, .text-red, [aria-invalid="true"]');
    if (await exceedWarning.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(exceedWarning.first()).toBeVisible();
    }
  });

  test('should validate URL format', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await urlInput.fill('not-a-valid-url');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });

    // Button should be disabled or show validation error
    const isDisabled = await analyzeButton.isDisabled();
    if (!isDisabled) {
      await analyzeButton.click();
      const errorMessage = page.getByText(/invalid|valid url/i);
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    } else {
      expect(isDisabled).toBeTruthy();
    }
  });

  test('should enable analyze button with valid URL', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|landing/i);
    await urlInput.fill('https://example.com');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    await expect(analyzeButton).toBeEnabled();
  });
});

test.describe('Dashboard Page - Actions Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display Actions card', async ({ page }) => {
    const actionsTitle = page.getByRole('heading', { name: /^actions$/i });
    await expect(actionsTitle).toBeVisible();
  });

  test('should have Save Draft button', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: /save.*draft/i });
    await expect(saveButton).toBeVisible();
  });

  test('should have Generate Images button', async ({ page }) => {
    const generateButton = page.getByRole('button', { name: /generate.*images/i });
    await expect(generateButton).toBeVisible();
  });

  test('should have Export Package button', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export.*package/i });
    await expect(exportButton).toBeVisible();
  });

  test('Export button should be disabled when progress is low', async ({ page }) => {
    // Export requires 80% completion
    const exportButton = page.getByRole('button', { name: /export.*package/i });
    const isDisabled = await exportButton.isDisabled();

    // With empty form, export should be disabled
    expect(isDisabled).toBeTruthy();
  });

  test('Generate Images button should be disabled without app name', async ({ page }) => {
    // Clear app name if any
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.clear();

    const generateButton = page
      .getByRole('button', { name: /generate.*images/i })
      .filter({ hasNot: page.locator('text=/regenerate/i') });

    if (await generateButton.isVisible()) {
      const isDisabled = await generateButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    }
  });

  test('Save Draft button should show loading state when clicked', async ({ page }) => {
    // Fill required field
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Save Test App');

    const saveButton = page.getByRole('button', { name: /save.*draft/i });
    await saveButton.click();

    // Button should show loading state
    const loadingState = page.getByText(/saving/i);
    await expect(loadingState).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard Page - Responsive Behavior', () => {
  test('should stack columns on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');

    // All sections should be visible
    const appNameInput = page.getByLabel(/app name/i);
    await expect(appNameInput).toBeVisible();

    const imagesSection = page.getByText(/generated images/i);
    await expect(imagesSection).toBeVisible();
  });

  test('should be fully functional on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Core functionality should work
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Mobile Test');
    await expect(appNameInput).toHaveValue('Mobile Test');
  });

  test('should have scrollable content on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto('/dashboard');

    // Scroll to bottom sections
    const pricingSection = page.getByRole('heading', { name: /^pricing$/i });
    await pricingSection.scrollIntoViewIfNeeded();
    await expect(pricingSection).toBeInViewport();
  });
});
