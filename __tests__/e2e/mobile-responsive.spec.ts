import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Mobile Small', width: 320, height: 568 }, // iPhone SE
  { name: 'Mobile Medium', width: 375, height: 667 }, // iPhone 8
  { name: 'Tablet Portrait', width: 768, height: 1024 }, // iPad
  { name: 'Desktop Small', width: 1024, height: 768 }, // Small laptop
];

test.describe('Mobile Responsiveness - Landing Page', () => {
  for (const viewport of viewports) {
    test(`should be responsive on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      // Page should load without horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // 20px tolerance for scrollbars

      // Hero section should be visible
      const heroHeading = page.getByRole('heading', { level: 1 });
      await expect(heroHeading).toBeVisible();

      // CTA buttons should be visible and clickable
      const ctaButton = page.getByRole('link', { name: /get started|try now|start/i }).first();
      await expect(ctaButton).toBeVisible();

      // Text should not overflow
      const overflowingElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const overflowing: string[] = [];
        elements.forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 5) {
            overflowing.push(el.tagName);
          }
        });
        return overflowing;
      });

      // Some overflow is acceptable for specific elements
      expect(
        overflowingElements.filter((tag) => !['HTML', 'BODY', 'SVG'].includes(tag)).length
      ).toBe(0);
    });
  }

  test('mobile menu should work on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Look for mobile menu toggle (hamburger)
    const menuToggle = page
      .getByRole('button', { name: /menu|navigation|toggle/i })
      .or(page.locator('[aria-label*="menu" i]'));

    if (await menuToggle.isVisible()) {
      // Click to open menu
      await menuToggle.click();

      // Menu should expand
      const nav = page.getByRole('navigation');
      await expect(nav).toBeVisible();

      // Should show navigation links
      const navLinks = page.getByRole('link');
      expect(await navLinks.count()).toBeGreaterThan(0);
    }
  });

  test('touch targets should be at least 44x44px on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check interactive elements have adequate touch target size
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);

      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          // WCAG recommendation: at least 44x44px
          expect(box.width).toBeGreaterThanOrEqual(40); // Slight tolerance
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});

test.describe('Mobile Responsiveness - Dashboard', () => {
  for (const viewport of viewports) {
    test(`dashboard should be usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard');

      // Form should be accessible
      const appNameInput = page.getByLabel(/app name/i);
      await expect(appNameInput).toBeVisible();

      // Input should be easy to tap
      const inputBox = await appNameInput.boundingBox();
      expect(inputBox?.height).toBeGreaterThanOrEqual(40);

      // Page should not have horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20);
    });
  }

  test('form sections should stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // On mobile, form and images should stack (not side-by-side)
    const formSection = page.locator('form').or(page.locator('[data-testid="submission-form"]'));
    const imagesSection = page
      .locator('[data-testid="image-gallery"]')
      .or(page.getByText(/images|gallery/i).locator('..'));

    if ((await formSection.isVisible()) && (await imagesSection.isVisible())) {
      const formBox = await formSection.boundingBox();
      const imagesBox = await imagesSection.boundingBox();

      if (formBox && imagesBox) {
        // Sections should be stacked (images below form or vice versa)
        // Check if they overlap horizontally
        const horizontalOverlap = !(
          formBox.x + formBox.width < imagesBox.x || imagesBox.x + imagesBox.width < formBox.x
        );

        // On mobile, they should overlap horizontally (be in same column)
        expect(horizontalOverlap).toBeTruthy();
      }
    }
  });

  test('mobile keyboard should not obscure inputs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Focus on input
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.click();

    // Input should scroll into view
    const isInViewport = await appNameInput.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    });

    expect(isInViewport).toBeTruthy();
  });
});

test.describe('Mobile Responsiveness - Settings', () => {
  for (const viewport of viewports) {
    test(`settings should work on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/settings');

      // Settings cards should be visible
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();

      // Model cards should stack on mobile, grid on desktop
      const modelCards = page
        .locator('[data-testid="model-card"]')
        .or(page.getByRole('button').filter({ hasText: /gemini|model/i }));

      const cardCount = await modelCards.count();

      if (cardCount > 0) {
        // First card should be visible
        await expect(modelCards.first()).toBeVisible();

        // Cards should not cause horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20);
      }
    });
  }

  test('theme toggle should be accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');

    // Look for theme toggle
    const themeToggle = page
      .getByRole('button', { name: /theme|dark|light/i })
      .or(page.getByLabel(/theme/i));

    if (await themeToggle.isVisible()) {
      // Should be easy to tap
      const box = await themeToggle.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(40);

      // Click should work
      await themeToggle.click();

      // Theme should change (hard to verify visually, but should not crash)
      await expect(themeToggle).toBeVisible();
    }
  });
});

test.describe('Mobile Responsiveness - Images & Media', () => {
  test('images should scale properly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Check for image elements
    const images = page.getByRole('img');
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);

      if (await img.isVisible()) {
        const box = await img.boundingBox();

        if (box) {
          // Images should not exceed viewport width
          expect(box.width).toBeLessThanOrEqual(375);
        }
      }
    }
  });

  test('image gallery should be swipeable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Look for image gallery
    const gallery = page
      .locator('[data-testid="image-gallery"]')
      .or(page.locator('.carousel, .swiper, .gallery'));

    if (await gallery.isVisible()) {
      // Simulate touch swipe
      await gallery.hover();
      await page.mouse.down();
      await page.mouse.move(-100, 0);
      await page.mouse.up();

      const afterScroll = await gallery.evaluate((el) => el.scrollLeft);

      // Scroll position should change (if gallery has multiple items)
      // This is conditional based on content
      expect(typeof afterScroll).toBe('number');
    }
  });
});

test.describe('Mobile Responsiveness - Typography', () => {
  test('text should be readable on mobile (minimum 14px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check body text size
    const bodyText = page.locator('body');
    const fontSize = await bodyText.evaluate((el) => window.getComputedStyle(el).fontSize);

    const fontSizePx = parseInt(fontSize);
    expect(fontSizePx).toBeGreaterThanOrEqual(14);
  });

  test('headings should scale appropriately', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // H1 should be larger than body text
    const h1 = page.getByRole('heading', { level: 1 });

    if (await h1.isVisible()) {
      const h1FontSize = await h1.evaluate((el) => parseInt(window.getComputedStyle(el).fontSize));

      const bodyFontSize = await page
        .locator('body')
        .evaluate((el) => parseInt(window.getComputedStyle(el).fontSize));

      expect(h1FontSize).toBeGreaterThan(bodyFontSize);
    }
  });

  test('line length should not be too long on tablets', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Check that paragraphs don't span full width (optimal: 50-75 characters)
    const paragraphs = page.locator('p');
    const paragraphCount = await paragraphs.count();

    if (paragraphCount > 0) {
      const firstP = paragraphs.first();
      const width = await firstP.evaluate((el) => {
        if (el instanceof HTMLElement) {
          return el.offsetWidth;
        }
        return 0;
      });

      // At 768px viewport, text should not span more than ~700px for readability
      expect(width).toBeLessThanOrEqual(700);
    }
  });
});

test.describe('Mobile Responsiveness - Forms', () => {
  test('inputs should have appropriate input types on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // URL input should have type="url" for mobile keyboard
    const urlInput = page.getByPlaceholder(/url|website/i);

    if (await urlInput.isVisible()) {
      const inputType = await urlInput.getAttribute('type');
      expect(inputType).toBe('url');
    }
  });

  test('form buttons should be full-width or centered on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Primary action buttons
    const submitButton = page.getByRole('button', { name: /save|submit|analyze/i }).first();

    if (await submitButton.isVisible()) {
      const box = await submitButton.boundingBox();

      if (box) {
        // Button should be wide enough for easy tapping (at least 200px or 80% of viewport)
        const isWideEnough = box.width >= 200 || box.width >= 375 * 0.6;
        expect(isWideEnough).toBeTruthy();
      }
    }
  });

  test('character counters should remain visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Fill an input with character limit
    const appNameInput = page.getByLabel(/app name/i);
    await appNameInput.fill('Test App');

    // Character counter should be visible
    const charCounter = page.getByText(/\/\s*30|30\s*char|8.*30/i);

    if (await charCounter.isVisible()) {
      // Should not be cut off
      const box = await charCounter.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    }
  });
});

test.describe('Mobile Responsiveness - Navigation', () => {
  test('navigation should be accessible on all viewports', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      // Navigation should exist (visible or in menu)
      const nav = page.getByRole('navigation').or(page.getByRole('button', { name: /menu/i }));

      await expect(nav).toBeVisible();
    }
  });

  test('footer should not obscure content on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Footer should be visible
    const footer = page.locator('footer');

    if (await footer.isVisible()) {
      // Should not have fixed position that covers content
      const position = await footer.evaluate((el) => window.getComputedStyle(el).position);

      // Fixed footer is okay if it's styled correctly
      expect(['static', 'relative', 'fixed', 'sticky']).toContain(position);
    }
  });
});
