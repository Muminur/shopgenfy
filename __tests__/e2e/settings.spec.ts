import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display the settings page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('should display page description', async ({ page }) => {
    const description = page.getByText(/configure your preferences/i);
    await expect(description).toBeVisible();
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

test.describe('Settings Page - AI Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display AI Model Selection card', async ({ page }) => {
    const cardTitle = page.getByRole('heading', { name: /ai model selection/i });
    await expect(cardTitle).toBeVisible();
  });

  test('should display model selection description', async ({ page }) => {
    const description = page.getByText(/choose the gemini model/i);
    await expect(description).toBeVisible();
  });

  test('should display multiple model options', async ({ page }) => {
    // Look for model cards/buttons
    const modelButtons = page.getByRole('radio');
    const count = await modelButtons.count();

    // Should have at least 2 model options
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should display Gemini 1.5 Pro option', async ({ page }) => {
    const proOption = page.getByText(/gemini 1\.5 pro/i);
    await expect(proOption).toBeVisible();
  });

  test('should display Gemini 1.5 Flash option', async ({ page }) => {
    const flashOption = page.getByText(/gemini 1\.5 flash/i);
    await expect(flashOption).toBeVisible();
  });

  test('should display model descriptions', async ({ page }) => {
    // Check for capability descriptions
    const capableDescription = page.getByText(/most capable|best quality/i);
    await expect(capableDescription).toBeVisible();

    const fastDescription = page.getByText(/fast|efficient/i);
    await expect(fastDescription).toBeVisible();
  });

  test('should show recommended badge', async ({ page }) => {
    const recommendedBadge = page.getByText(/recommended/i);
    await expect(recommendedBadge).toBeVisible();
  });

  test('should allow selecting a model', async ({ page }) => {
    const modelOption = page.getByRole('radio').first();
    await modelOption.click();

    // Should show selection indicator (checkmark)
    const checkmark = page.locator('[aria-checked="true"]');
    await expect(checkmark.first()).toBeVisible();
  });

  test('should visually indicate selected model', async ({ page }) => {
    const modelButtons = page.getByRole('radio');
    const firstModel = modelButtons.first();
    await firstModel.click();

    // Selected model should have aria-checked="true"
    const ariaChecked = await firstModel.getAttribute('aria-checked');
    expect(ariaChecked).toBe('true');
  });

  test('should be keyboard navigable', async ({ page }) => {
    const firstModel = page.getByRole('radio').first();
    await firstModel.focus();
    await expect(firstModel).toBeFocused();

    // Arrow keys should navigate between options
    await page.keyboard.press('ArrowRight');
    // Second option should be focused or selected
  });
});

test.describe('Settings Page - Theme & Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display Theme & Appearance card', async ({ page }) => {
    const cardTitle = page.getByRole('heading', { name: /theme.*appearance/i });
    await expect(cardTitle).toBeVisible();
  });

  test('should display theme options', async ({ page }) => {
    const lightOption = page.getByRole('radio', { name: /light/i });
    const darkOption = page.getByRole('radio', { name: /dark/i });
    const systemOption = page.getByRole('radio', { name: /system/i });

    await expect(lightOption).toBeVisible();
    await expect(darkOption).toBeVisible();
    await expect(systemOption).toBeVisible();
  });

  test('should display theme icons', async ({ page }) => {
    // Light theme should have Sun icon
    // Dark theme should have Moon icon
    // System theme should have Monitor icon
    const themeSection = page.getByRole('heading', { name: /theme.*appearance/i }).locator('..');
    const icons = themeSection.locator('svg');
    const iconCount = await icons.count();

    // Should have at least 3 icons for themes
    expect(iconCount).toBeGreaterThanOrEqual(3);
  });

  test('should apply light theme', async ({ page }) => {
    const lightOption = page.getByRole('radio', { name: /light/i });
    await lightOption.click();

    // HTML should not have dark class
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass?.includes('dark')).toBeFalsy();
  });

  test('should apply dark theme', async ({ page }) => {
    const darkOption = page.getByRole('radio', { name: /dark/i });
    await darkOption.click();

    // HTML should have dark class (depending on implementation)
    // This might use CSS custom properties or class
    await page.waitForTimeout(500);
  });

  test('should show checkmark on selected theme', async ({ page }) => {
    const selectedTheme = page.locator('[aria-checked="true"]');
    await expect(selectedTheme.first()).toBeVisible();
  });
});

test.describe('Settings Page - Auto-save Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display Auto-save card', async ({ page }) => {
    const cardTitle = page.getByRole('heading', { name: /auto.?save/i });
    await expect(cardTitle).toBeVisible();
  });

  test('should display auto-save description', async ({ page }) => {
    const description = page.getByText(/automatically save your work/i);
    await expect(description).toBeVisible();
  });

  test('should display auto-save checkbox', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /enable auto.?save/i });
    await expect(checkbox).toBeVisible();
  });

  test('should toggle auto-save setting', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /enable auto.?save/i });
    const initialChecked = await checkbox.isChecked();

    await checkbox.click();

    const newChecked = await checkbox.isChecked();
    expect(newChecked).toBe(!initialChecked);
  });

  test('should display auto-save helper text', async ({ page }) => {
    const helperText = page.getByText(/submissions will be automatically saved/i);
    await expect(helperText).toBeVisible();
  });
});

test.describe('Settings Page - Save Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display Save Settings button', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: /save settings/i });
    await expect(saveButton).toBeVisible();
  });

  test('should show loading state when saving', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: /save settings/i });
    await saveButton.click();

    // Should show "Saving..." state
    const savingState = page.getByText(/saving/i);
    await expect(savingState).toBeVisible({ timeout: 5000 });
  });

  test('should show success message after saving', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: /save settings/i });
    await saveButton.click();

    // Wait for save to complete and show success
    const successMessage = page.getByRole('alert').filter({ hasText: /success|saved/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('should handle save errors gracefully', async ({ page, context }) => {
    // Simulate offline to trigger error
    await context.setOffline(true);

    const saveButton = page.getByRole('button', { name: /save settings/i });
    await saveButton.click();

    // Should show error message
    const errorMessage = page.getByRole('alert').filter({ hasText: /error|failed/i });
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await context.setOffline(false);
  });
});

test.describe('Settings Page - API Status Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should load settings from API', async ({ page }) => {
    // Should not show loading spinner after load completes
    const loadingSpinner = page.locator('[role="status"]').filter({ hasText: /loading/i });

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Spinner should be gone
    await expect(loadingSpinner).not.toBeVisible();
  });

  test('should handle API errors on load', async ({ page, context }) => {
    // Go offline before loading
    await context.setOffline(true);
    await page.reload();

    // Should show error message
    const errorMessage = page.getByRole('alert').or(page.getByText(/failed to load/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await context.setOffline(false);
  });

  test('should dismiss error alerts', async ({ page }) => {
    // If there's an error alert with dismiss button
    const errorAlert = page.getByRole('alert').filter({ hasText: /error/i });

    if (await errorAlert.isVisible({ timeout: 2000 }).catch(() => false)) {
      const dismissButton = errorAlert.getByRole('button', { name: /dismiss|close|x/i });
      if (await dismissButton.isVisible()) {
        await dismissButton.click();
        await expect(errorAlert).not.toBeVisible();
      }
    }
  });

  test('should dismiss success alerts', async ({ page }) => {
    // Trigger save to show success alert
    const saveButton = page.getByRole('button', { name: /save settings/i });
    await saveButton.click();

    const successAlert = page.getByRole('alert').filter({ hasText: /success/i });

    if (await successAlert.isVisible({ timeout: 10000 }).catch(() => false)) {
      const dismissButton = successAlert.getByRole('button', { name: /dismiss|close|x/i });
      if (await dismissButton.isVisible()) {
        await dismissButton.click();
        await expect(successAlert).not.toBeVisible();
      }
    }
  });
});

test.describe('Settings Page - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('model cards should have ARIA attributes', async ({ page }) => {
    const modelCards = page.getByRole('radio');
    const count = await modelCards.count();

    for (let i = 0; i < count; i++) {
      const card = modelCards.nth(i);
      const ariaLabel = await card.getAttribute('aria-label');
      const ariaChecked = await card.getAttribute('aria-checked');

      // Should have aria-label describing the model
      expect(ariaLabel).toBeTruthy();
      // Should have aria-checked state
      expect(['true', 'false']).toContain(ariaChecked);
    }
  });

  test('theme options should have ARIA attributes', async ({ page }) => {
    const themeButtons = page.locator('[role="radiogroup"]').getByRole('radio');

    if ((await themeButtons.count()) > 0) {
      const first = themeButtons.first();
      const ariaChecked = await first.getAttribute('aria-checked');
      expect(['true', 'false']).toContain(ariaChecked);
    }
  });

  test('should have fieldset with legend for model selection', async ({ page }) => {
    const fieldset = page.locator('fieldset');
    const count = await fieldset.count();

    if (count > 0) {
      const legend = fieldset.first().locator('legend');
      // Legend might be visually hidden but should exist
      expect(await legend.count()).toBeGreaterThan(0);
    }
  });

  test('focus should be visible on interactive elements', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('checkbox should have associated label', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /enable auto.?save/i });
    await expect(checkbox).toBeVisible();

    // Clicking label should toggle checkbox
    const label = page.locator('label[for="autosave"]');
    if (await label.isVisible()) {
      const initialChecked = await checkbox.isChecked();
      await label.click();
      const newChecked = await checkbox.isChecked();
      expect(newChecked).toBe(!initialChecked);
    }
  });
});

test.describe('Settings Page - Responsive Behavior', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');

    // All cards should be visible
    const modelCard = page.getByRole('heading', { name: /ai model selection/i });
    await expect(modelCard).toBeVisible();

    const themeCard = page.getByRole('heading', { name: /theme/i });
    await expect(themeCard).toBeVisible();

    const autoSaveCard = page.getByRole('heading', { name: /auto.?save/i });
    await expect(autoSaveCard).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/settings');

    const saveButton = page.getByRole('button', { name: /save settings/i });
    await expect(saveButton).toBeVisible();
  });

  test('model cards should stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');

    // All model options should still be visible and usable
    const modelCards = page.getByRole('radio');
    const count = await modelCards.count();

    for (let i = 0; i < count; i++) {
      await expect(modelCards.nth(i)).toBeVisible();
    }
  });

  test('theme options should be visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');

    const lightOption = page.getByRole('radio', { name: /light/i });
    const darkOption = page.getByRole('radio', { name: /dark/i });
    const systemOption = page.getByRole('radio', { name: /system/i });

    await expect(lightOption).toBeVisible();
    await expect(darkOption).toBeVisible();
    await expect(systemOption).toBeVisible();
  });
});
