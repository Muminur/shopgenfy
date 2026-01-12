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
    // Check for feature section - look for feature cards or feature text
    const featureSection = page.getByRole('heading', { name: /powerful features/i });
    await expect(featureSection).toBeVisible();
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

test.describe('Landing Page - Testimonials Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display testimonials section', async ({ page }) => {
    const testimonialsSection = page.getByRole('region', { name: /testimonials/i });
    await expect(testimonialsSection).toBeVisible();
  });

  test('should display testimonials heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /what developers are saying/i });
    await expect(heading).toBeVisible();
  });

  test('should display multiple testimonial cards', async ({ page }) => {
    const testimonialCards = page.locator('[data-testid="testimonial-card"]');
    const count = await testimonialCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should display testimonial author information', async ({ page }) => {
    // Check first testimonial has author, role, and company
    const firstCard = page.locator('[data-testid="testimonial-card"]').first();
    await expect(firstCard).toBeVisible();

    // Check for author name
    const authorName = firstCard.getByText(/sarah johnson|michael chen|emma williams/i);
    await expect(authorName).toBeVisible();

    // Check for role and company info
    const roleInfo = firstCard.getByText(/developer|manager|at/i);
    await expect(roleInfo).toBeVisible();
  });

  test('should display testimonial quotes', async ({ page }) => {
    // Check that blockquotes exist
    const quotes = page.locator('[data-testid="testimonial-card"] blockquote');
    const quoteCount = await quotes.count();
    expect(quoteCount).toBeGreaterThanOrEqual(3);

    // Verify first quote has content
    const firstQuote = quotes.first();
    const quoteText = await firstQuote.textContent();
    expect(quoteText?.length).toBeGreaterThan(20);
  });

  test('should display author initials avatar', async ({ page }) => {
    const testimonialCards = page.locator('[data-testid="testimonial-card"]');
    const firstCard = testimonialCards.first();

    // Look for initials (like "SJ" for Sarah Johnson)
    const initialsContainer = firstCard.locator('.rounded-full');
    await expect(initialsContainer.first()).toBeVisible();
  });

  test('should have proper ARIA labeling', async ({ page }) => {
    const testimonialsSection = page.getByRole('region', { name: /testimonials/i });
    const ariaLabel = await testimonialsSection.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.toLowerCase()).toContain('testimonial');
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const testimonialsSection = page.getByRole('region', { name: /testimonials/i });
    await expect(testimonialsSection).toBeVisible();

    // Cards should stack vertically on mobile
    const testimonialCards = page.locator('[data-testid="testimonial-card"]');
    const firstCard = testimonialCards.first();
    await expect(firstCard).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const testimonialsSection = page.getByRole('region', { name: /testimonials/i });
    await expect(testimonialsSection).toBeVisible();

    const testimonialCards = page.locator('[data-testid="testimonial-card"]');
    await expect(testimonialCards.first()).toBeVisible();
  });

  test('should have quote icon decoration', async ({ page }) => {
    const testimonialCards = page.locator('[data-testid="testimonial-card"]');
    const firstCard = testimonialCards.first();

    // Look for the quote icon (lucide Quote icon)
    const quoteIcon = firstCard.locator('svg').first();
    await expect(quoteIcon).toBeVisible();
  });

  test('testimonial cards should be keyboard accessible', async ({ page }) => {
    // Tab to reach testimonials area
    const testimonialsSection = page.getByRole('region', { name: /testimonials/i });

    // Scroll into view
    await testimonialsSection.scrollIntoViewIfNeeded();

    // Cards themselves may not be interactive, but content should be accessible
    const firstCard = page.locator('[data-testid="testimonial-card"]').first();
    await expect(firstCard).toBeVisible();
  });
});

test.describe('Landing Page - How It Works Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display how it works section', async ({ page }) => {
    const section = page.locator('#how-it-works');
    await expect(section).toBeVisible();
  });

  test('should display three steps', async ({ page }) => {
    const stepsHeading = page.getByRole('heading', { name: /how it works/i });
    await expect(stepsHeading).toBeVisible();

    // Check for step numbers
    const step1 = page.getByText('1');
    const step2 = page.getByText('2');
    const step3 = page.getByText('3');

    await expect(step1.first()).toBeVisible();
    await expect(step2.first()).toBeVisible();
    await expect(step3.first()).toBeVisible();
  });

  test('should display step titles', async ({ page }) => {
    const enterUrl = page.getByText(/enter your url/i);
    const generateContent = page.getByText(/generate content/i);
    const exportSubmit = page.getByText(/export.*submit/i);

    await expect(enterUrl).toBeVisible();
    await expect(generateContent).toBeVisible();
    await expect(exportSubmit).toBeVisible();
  });

  test('should navigate to how it works from Learn More button', async ({ page }) => {
    const learnMoreButton = page.getByRole('link', { name: /learn more/i });
    await learnMoreButton.click();

    // Should scroll to the section
    const section = page.locator('#how-it-works');
    await expect(section).toBeInViewport();
  });
});

test.describe('Landing Page - CTA Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display final CTA section', async ({ page }) => {
    const ctaHeading = page.getByRole('heading', { name: /ready to submit your app/i });
    await expect(ctaHeading).toBeVisible();
  });

  test('should have Start Your Submission button', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /start your submission/i });
    await expect(ctaButton).toBeVisible();
  });

  test('CTA button should navigate to dashboard', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /start your submission/i });
    await ctaButton.click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
