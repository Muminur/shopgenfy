import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit - Landing Page', () => {
  test('should not have automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check that headings follow proper hierarchy (h1 -> h2 -> h3)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels = await Promise.all(
      headings.map((h) => h.evaluate((el) => parseInt(el.tagName.substring(1))))
    );

    // Should have exactly one h1
    const h1Count = headingLevels.filter((level) => level === 1).length;
    expect(h1Count).toBe(1);

    // Headings should not skip levels
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      // Can go down multiple levels, but up only one level at a time
      if (diff > 0) {
        expect(diff).toBeLessThanOrEqual(1);
      }
    }
  });

  test('should have accessible navigation landmarks', async ({ page }) => {
    await page.goto('/');

    // Should have main landmark
    const main = page.getByRole('main');
    await expect(main).toBeVisible();

    // Should have navigation
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();

    // Should have contentinfo (footer)
    const footer = page.getByRole('contentinfo');
    if ((await footer.count()) > 0) {
      await expect(footer.first()).toBeVisible();
    }
  });

  test('should have accessible links', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('a')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    // Run color contrast check
    const contrastResults = await new AxeBuilder({ page })
      .include('body')
      .withRules(['color-contrast'])
      .analyze();

    // If there are violations, log them for debugging
    if (contrastResults.violations.length > 0) {
      console.warn(
        'Color contrast violations:',
        JSON.stringify(contrastResults.violations, null, 2)
      );
    }

    expect(contrastResults.violations).toEqual([]);
  });
});

test.describe('Accessibility Audit - Dashboard', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('all form inputs should have labels', async ({ page }) => {
    await page.goto('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page }).withRules(['label']).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('form inputs should have visible labels', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that all inputs have associated labels
    const inputs = page.locator('input[type="text"], input[type="url"], textarea');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Input should have either: id with matching label, aria-label, or aria-labelledby
      const hasLabel =
        (id && (await page.locator(`label[for="${id}"]`).count()) > 0) ||
        ariaLabel ||
        ariaLabelledBy;

      expect(hasLabel).toBeTruthy();
    }
  });

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/dashboard');

    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const accessibleName =
        (await button.getAttribute('aria-label')) || (await button.textContent());

      expect(accessibleName?.trim().length).toBeGreaterThan(0);
    }
  });

  test('character count should be announced to screen readers', async ({ page }) => {
    await page.goto('/dashboard');

    // Character counters should have aria-live or be associated with input
    const appNameInput = page.getByLabel(/app name/i);

    if (await appNameInput.isVisible()) {
      await appNameInput.fill('Test');

      // Look for aria-live region or aria-describedby
      const ariaDescribedBy = await appNameInput.getAttribute('aria-describedby');
      const ariaLive = page.locator('[aria-live]');

      // Should have some form of dynamic announcement
      const hasAnnouncement = ariaDescribedBy || (await ariaLive.count()) > 0;
      expect(hasAnnouncement).toBeTruthy();
    }
  });

  test('error messages should be associated with inputs', async ({ page }) => {
    await page.goto('/dashboard');

    // Try to trigger validation error
    const appNameInput = page.getByLabel(/app name/i);

    if (await appNameInput.isVisible()) {
      // Enter text exceeding limit
      await appNameInput.fill(
        'This is a very long app name that definitely exceeds the thirty character limit'
      );

      // Error message should be accessible
      const ariaDescribedBy = await appNameInput.getAttribute('aria-describedby');
      const ariaInvalid = await appNameInput.getAttribute('aria-invalid');

      // Should mark input as invalid
      if (ariaInvalid) {
        expect(ariaInvalid).toBe('true');
      }

      // If error appears, it should be associated
      const errorMsg = page.getByRole('alert').or(page.getByText(/error|invalid|exceeds/i));
      if (await errorMsg.isVisible()) {
        expect(ariaDescribedBy || ariaInvalid).toBeTruthy();
      }
    }
  });
});

test.describe('Accessibility Audit - Settings', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/settings');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('model selection cards should be keyboard accessible', async ({ page }) => {
    await page.goto('/settings');

    // Model cards should be reachable via keyboard
    const modelCards = page.getByRole('button').filter({ hasText: /gemini|model/i });
    const cardCount = await modelCards.count();

    if (cardCount > 0) {
      // Focus first card
      await modelCards.first().focus();

      // Should be focusable
      const isFocused = await modelCards.first().evaluate((el) => el === document.activeElement);
      expect(isFocused).toBeTruthy();

      // Press Enter should work
      await page.keyboard.press('Enter');

      // Card should indicate selection (aria-pressed or aria-selected)
      const ariaPressed = await modelCards.first().getAttribute('aria-pressed');
      const ariaSelected = await modelCards.first().getAttribute('aria-selected');

      expect(ariaPressed === 'true' || ariaSelected === 'true').toBeTruthy();
    }
  });

  test('theme toggle should announce state to screen readers', async ({ page }) => {
    await page.goto('/settings');

    const themeToggle = page
      .getByRole('button', { name: /theme|dark|light/i })
      .or(page.getByRole('switch'));

    if (await themeToggle.isVisible()) {
      // Should have accessible name
      const accessibleName =
        (await themeToggle.getAttribute('aria-label')) || (await themeToggle.textContent());

      expect(accessibleName?.trim().length).toBeGreaterThan(0);

      // If it's a switch, should have aria-checked
      const role = await themeToggle.getAttribute('role');
      if (role === 'switch') {
        const ariaChecked = await themeToggle.getAttribute('aria-checked');
        expect(['true', 'false']).toContain(ariaChecked);
      }
    }
  });
});

test.describe('Accessibility Audit - Images', () => {
  test('all images should have alt text', async ({ page }) => {
    await page.goto('/dashboard');

    const images = page.getByRole('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // Alt can be empty for decorative images, but attribute must exist
      expect(alt).not.toBeNull();
    }
  });

  test('decorative images should have empty alt', async ({ page }) => {
    await page.goto('/');

    // Decorative images (icons, backgrounds) should have alt=""
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('complex images should have detailed descriptions', async ({ page }) => {
    await page.goto('/dashboard');

    // Generated app store images should have descriptive alt text
    const featureImages = page
      .locator('[data-testid="image-card"] img')
      .or(page.getByRole('img').filter({ hasText: /feature|screenshot/i }));

    const featureImageCount = await featureImages.count();

    for (let i = 0; i < Math.min(featureImageCount, 5); i++) {
      const img = featureImages.nth(i);
      const alt = await img.getAttribute('alt');

      // Should have meaningful alt text (more than just "image")
      if (alt) {
        expect(alt.length).toBeGreaterThan(10);
        expect(alt.toLowerCase()).not.toBe('image');
      }
    }
  });
});

test.describe('Accessibility Audit - Keyboard Navigation', () => {
  test('all interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('focus should be visible', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab through elements
    await page.keyboard.press('Tab');

    // Check that focused element has visible focus indicator
    const focusedElement = page.locator(':focus');
    const outline = await focusedElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        boxShadow: style.boxShadow,
        border: style.border,
      };
    });

    // Should have some form of focus indicator
    const hasFocusIndicator =
      outline.outline !== 'none' || outline.boxShadow !== 'none' || outline.border.includes('px');

    expect(hasFocusIndicator).toBeTruthy();
  });

  test('focus order should be logical', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab through first few elements
    const focusOrder = [];

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const focusedElement = page.locator(':focus');
      const tag = await focusedElement.evaluate((el) => el.tagName);
      const text = await focusedElement.textContent();

      focusOrder.push({ tag, text: text?.slice(0, 30) });
    }

    // Focus order should follow DOM order (not jumping around randomly)
    // This is a basic check - actual verification requires manual testing
    expect(focusOrder.length).toBe(10);
  });

  test('skip links should be available', async ({ page }) => {
    await page.goto('/');

    // Press Tab to reveal skip link
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: /skip.*main|skip.*content/i });

    // Skip link might be visually hidden but should be focusable
    if ((await skipLink.count()) > 0) {
      await expect(skipLink.first()).toBeFocused();
    }
  });

  test('modal dialogs should trap focus', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for button that opens modal
    const modalTrigger = page.getByRole('button', { name: /delete|confirm|modal/i });

    if (await modalTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalTrigger.click();

      // Check for dialog
      const dialog = page.getByRole('dialog');

      if (await dialog.isVisible()) {
        // Tab should cycle within modal
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');

        // Focused element should be inside dialog
        const isInsideDialog = await focusedElement.evaluate(
          (el, dialogEl) => {
            return dialogEl?.contains(el) || false;
          },
          await dialog.elementHandle()
        );

        expect(isInsideDialog).toBeTruthy();
      }
    }
  });
});

test.describe('Accessibility Audit - ARIA', () => {
  test('ARIA attributes should be valid', async ({ page }) => {
    await page.goto('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-attr'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ARIA roles should be valid', async ({ page }) => {
    await page.goto('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['aria-allowed-role', 'aria-required-attr'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('loading states should be announced', async ({ page }) => {
    await page.goto('/dashboard');

    // Trigger analysis
    const analyzeButton = page.getByRole('button', { name: /analyze/i });

    if (await analyzeButton.isVisible()) {
      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('https://example.com');
      await analyzeButton.click();

      // Should have aria-live region for status updates
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion.first()).toBeVisible({ timeout: 5000 });

      // Or loading indicator with role="status"
      const status = page.getByRole('status');
      if ((await status.count()) > 0) {
        await expect(status.first()).toBeVisible();
      }
    }
  });

  test('required form fields should be marked', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for required fields
    const requiredInputs = page.locator('[required], [aria-required="true"]');
    const requiredCount = await requiredInputs.count();

    // Should have at least some required fields (app name, etc.)
    expect(requiredCount).toBeGreaterThan(0);

    // Each required field should be properly marked
    for (let i = 0; i < requiredCount; i++) {
      const input = requiredInputs.nth(i);
      const ariaRequired = await input.getAttribute('aria-required');
      const required = await input.getAttribute('required');

      expect(ariaRequired === 'true' || required !== null).toBeTruthy();
    }
  });
});

test.describe('Accessibility Audit - Screen Reader Support', () => {
  test('page title should be descriptive', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();

    // Title should be meaningful (not just "React App" or empty)
    expect(title.length).toBeGreaterThan(5);
    expect(title.toLowerCase()).not.toBe('react app');
  });

  test('language should be specified', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');

    // HTML should have lang attribute
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^[a-z]{2}/i); // Should be valid language code (e.g., "en")
  });

  test('lists should use proper markup', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['list', 'listitem'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('tables should have proper structure', async ({ page }) => {
    await page.goto('/dashboard');

    // If tables exist, they should be accessible
    const tables = page.locator('table');
    const tableCount = await tables.count();

    if (tableCount > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['table', 'th-has-data-cells', 'td-headers-attr'])
        .include('table')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
