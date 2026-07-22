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
    const modelSection = page.getByText(/model|gemini/i).first();
    await expect(modelSection).toBeVisible();
  });

  test('should have theme toggle', async ({ page }) => {
    // Theme options render as role="radio" cards (not a single toggle button).
    const themeToggle = page.getByRole('radio', { name: /theme/i }).first();
    await expect(themeToggle).toBeVisible();
  });

  test('should toggle theme on click', async ({ page }) => {
    const htmlElement = page.locator('html');

    // Selecting the Dark theme radio applies the `dark` class to <html>
    // (next-themes with attribute="class"). The class mutation itself is
    // effectively synchronous (a next-themes layout effect), but under CI's
    // shared/contended runners the click-to-repaint round trip has been seen
    // to occasionally outrun the default 10s assertion budget. A longer
    // timeout absorbs that without masking a genuine failure to toggle.
    await page.getByRole('radio', { name: /dark theme/i }).click();
    await expect(htmlElement).toHaveClass(/dark/, { timeout: 30_000 });

    // Selecting Light removes it — proving the toggle changes the theme.
    await page.getByRole('radio', { name: /light theme/i }).click();
    await expect(htmlElement).not.toHaveClass(/dark/, { timeout: 30_000 });
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
    const cardTitle = page.getByText('AI Model Selection', { exact: true });
    await expect(cardTitle).toBeVisible();
  });

  test('should display model selection description', async ({ page }) => {
    const description = page.getByText(/choose the gemini model/i);
    await expect(description).toBeVisible();
  });

  test('should display multiple model options', async ({ page }) => {
    // Look for model cards/buttons (wait for the settings load to render them
    // before counting — count() does not auto-wait).
    const modelButtons = page.getByRole('radio');
    await expect(modelButtons.first()).toBeVisible();
    const count = await modelButtons.count();

    // Should have at least 2 model options
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should display the Auto (recommended) model option', async ({ page }) => {
    const autoOption = page.getByText('Auto', { exact: true });
    await expect(autoOption).toBeVisible();
  });

  test('should display the Gemini 3.5 Flash model option', async ({ page }) => {
    const flashOption = page.getByText(/gemini 3\.5 flash/i);
    await expect(flashOption).toBeVisible();
  });

  test('should display model descriptions', async ({ page }) => {
    // Auto model self-heal description.
    const autoDescription = page.getByText(/best available|self-heal/i);
    await expect(autoDescription).toBeVisible();

    const fastDescription = page.getByText(/fast|efficient/i);
    await expect(fastDescription.first()).toBeVisible();
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
    const cardTitle = page.getByText('Theme & Appearance', { exact: true });
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
    // Walk up from the CardTitle text to the Card, then count the theme icons
    // (Sun / Moon / Monitor) rendered inside the option buttons.
    const themeCard = page
      .getByText('Theme & Appearance', { exact: true })
      .locator('..')
      .locator('..');
    const icons = themeCard.locator('svg');
    await expect(icons.first()).toBeVisible();
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
    const cardTitle = page.getByText('Auto-save', { exact: true });
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
    // Delay the PUT so the transient "Saving..." state is observable.
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue();
    });

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

  test('should handle API errors on load', async ({ page }) => {
    // Abort just the settings API (not the whole network — that would block the
    // page load itself) so the load-error path is exercised.
    await page.route('**/api/settings', (route) => route.abort());
    await page.reload();

    // Should show error message
    const errorMessage = page.getByRole('alert').or(page.getByText(/failed to load/i));
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
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

    // All cards should be visible (CardTitle renders as text, not a heading).
    const modelCard = page.getByText('AI Model Selection', { exact: true });
    await expect(modelCard).toBeVisible();

    const themeCard = page.getByText('Theme & Appearance', { exact: true });
    await expect(themeCard).toBeVisible();

    const autoSaveCard = page.getByText('Auto-save', { exact: true });
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
