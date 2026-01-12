import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Dashboard "Analyze with AI" workflow
 * These tests mock the Gemini API to test the full workflow without requiring real API keys
 */

// Mock API response for successful analysis
// Note: The actual Gemini API returns 'featureList' not 'features'
const mockAnalysisResponse = {
  appName: 'AISpree Assistant',
  appIntroduction: 'Your AI-powered productivity companion',
  appDescription:
    'AISpree Assistant helps you streamline your workflow with intelligent automation and smart suggestions.',
  featureList: [
    'Smart task management',
    'AI-powered suggestions',
    'Workflow automation',
    'Team collaboration',
  ],
  languages: ['en', 'es', 'fr'],
  primaryCategory: 'Productivity',
  featureTags: ['ai', 'automation', 'productivity', 'workflow'],
  pricing: { type: 'freemium' },
  confidence: 0.92,
};

test.describe('Dashboard - Analyze with AI Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Gemini analyze API endpoint
    await page.route('**/api/gemini/analyze', async (route) => {
      const request = route.request();
      const body = request.postDataJSON();

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (body?.url?.includes('invalid') || body?.url?.includes('error')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to analyze URL' }),
        });
      } else if (body?.url) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAnalysisResponse),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'URL is required' }),
        });
      }
    });

    await page.goto('/dashboard');
  });

  test('should display analyze button and URL input', async ({ page }) => {
    // URL input with placeholder "https://your-app.com"
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await expect(urlInput).toBeVisible();

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await expect(analyzeButton).toBeVisible();
  });

  test('should enable analyze button when valid URL is entered', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await expect(analyzeButton).toBeEnabled();
  });

  test('should show loading state during analysis', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Should show loading state "Analyzing..."
    const loadingIndicator = page.getByText('Analyzing...');
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should auto-fill form fields after successful analysis', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Wait for analysis to complete
    await page.waitForResponse('**/api/gemini/analyze');

    // App name should be filled (label is "App Name")
    const appNameInput = page.getByLabel('App Name');
    await expect(appNameInput).toHaveValue(mockAnalysisResponse.appName, { timeout: 10000 });

    // App introduction should be filled (label is "App Introduction (Tagline)")
    const appIntroInput = page.getByLabel('App Introduction (Tagline)');
    await expect(appIntroInput).toHaveValue(mockAnalysisResponse.appIntroduction);
  });

  test('should display error message when analysis fails', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://invalid-test-error.com');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Wait for error response
    await page.waitForResponse('**/api/gemini/analyze');

    // Should show error message in AlertMessage component
    const errorMessage = page.getByText(/failed to analyze/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should update progress indicator after analysis', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Wait for analysis to complete
    await page.waitForResponse('**/api/gemini/analyze');

    // Wait for form to be filled
    await page.waitForTimeout(500);

    // Progress should increase after auto-fill (shown as "X% Complete")
    const progressText = page.getByText(/\d+% Complete/);
    await expect(progressText).toBeVisible();
  });

  test('should allow re-analyzing with different URL', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Wait for first analysis
    await page.waitForResponse('**/api/gemini/analyze');

    // Clear and enter new URL
    await urlInput.clear();
    await urlInput.fill('https://another-site.com');
    await analyzeButton.click();

    // Wait for second analysis
    await page.waitForResponse('**/api/gemini/analyze');

    // Form should still be filled
    const appNameInput = page.getByLabel('App Name');
    await expect(appNameInput).toHaveValue(mockAnalysisResponse.appName);
  });
});

test.describe('Dashboard - Analyze with AI Error States', () => {
  test('should show loading state while waiting for slow response', async ({ page }) => {
    // Mock a slow response
    await page.route('**/api/gemini/analyze', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ appName: 'Test' }),
      });
    });

    await page.goto('/dashboard');

    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });
    await analyzeButton.click();

    // Should show loading state while waiting
    const loadingIndicator = page.getByText('Analyzing...');
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard - Full Workflow Integration', () => {
  test('should complete full workflow: analyze -> fill form -> save draft', async ({ page }) => {
    // Set up route handlers BEFORE navigation
    await page.route('**/api/gemini/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          appName: 'WorkflowTest App',
          appIntroduction: 'Test tagline for workflow',
          appDescription: 'Complete workflow test description',
          featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
          languages: ['en'],
          primaryCategory: 'Store design',
          featureTags: ['test', 'workflow'],
          pricing: { type: 'free' },
          confidence: 0.95,
        }),
      });
    });

    await page.route('**/api/submissions**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'submission-123', status: 'draft' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    // Navigate after routes are set up
    await page.goto('/dashboard');

    // Step 1: Enter URL and analyze
    const urlInput = page.getByPlaceholder('https://your-app.com');
    await urlInput.fill('https://aispree.cloud');

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i });

    // Use Promise.all to click and wait for response simultaneously
    const [response] = await Promise.all([
      page.waitForResponse('**/api/gemini/analyze'),
      analyzeButton.click(),
    ]);

    expect(response.status()).toBe(200);

    // Verify form is filled
    const appNameInput = page.getByLabel('App Name');
    await expect(appNameInput).toHaveValue('WorkflowTest App', { timeout: 10000 });

    // Step 2: Save draft
    const saveButton = page.getByRole('button', { name: /save draft/i });

    // Use Promise.all for save as well
    const [saveResponse] = await Promise.all([
      page.waitForResponse('**/api/submissions**'),
      saveButton.click(),
    ]);

    expect(saveResponse.status()).toBe(200);

    // Should show success message
    const successMessage = page.getByText(/saved successfully/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });
});
