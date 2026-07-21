import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';

/**
 * Hermetic end-to-end happy paths for the revived core flow.
 *
 * These run entirely offline: the upstream stub (see `stub-server.mjs`, wired
 * via `playwright.config.ts` -> `webServer.env`) serves Gemini/Pollinations, and
 * an in-memory mongod backs persistence. Analyze paths that would trigger a
 * server-side webpage fetch (blocked by the app's SSRF guard for 127.x) are
 * mocked at the browser level; the image/export paths exercise the REAL server
 * routes through the stub so `/api/images/*` + the stateless export are proven.
 */

const ANALYSIS = {
  appName: 'Hermetic Demo',
  appIntroduction: 'Prove the pipeline offline',
  appDescription: 'A deterministic analysis result used to prove the analyze pipeline end to end.',
  featureList: ['Fast sync', 'Smart reports', 'Multi-language'],
  languages: ['en'],
  primaryCategory: 'Store design',
  featureTags: ['testing'],
  pricing: { type: 'free' },
  confidence: 0.9,
  screenshots: [],
};

test.describe('Hermetic core flows', () => {
  test('URL analyze auto-fills the form (stubbed)', async ({ page }) => {
    await page.route('**/api/gemini/analyze', async (route) => {
      const body = route.request().postDataJSON();
      expect(body?.sourceType).toBe('url');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ANALYSIS),
      });
    });

    await page.goto('/dashboard');

    await page.getByPlaceholder('https://your-app.com').fill('https://example.com');
    await page.getByRole('button', { name: /analyze with ai/i }).click();

    await expect(page.getByLabel('App Name')).toHaveValue(ANALYSIS.appName, { timeout: 10_000 });
    await expect(page.getByLabel('App Introduction (Tagline)')).toHaveValue(
      ANALYSIS.appIntroduction
    );
  });

  test('GitHub tab submit auto-fills the form (stubbed)', async ({ page }) => {
    await page.route('**/api/gemini/analyze', async (route) => {
      const body = route.request().postDataJSON();
      expect(body?.sourceType).toBe('github');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...ANALYSIS, appName: 'GitHub Repo App' }),
      });
    });

    await page.goto('/dashboard');

    await page.getByRole('tab', { name: /github repo/i }).click();
    await page
      .getByPlaceholder('https://github.com/owner/repo')
      .fill('https://github.com/acme/widget');
    await page.getByRole('button', { name: /analyze repo/i }).click();

    await expect(page.getByLabel('App Name')).toHaveValue('GitHub Repo App', { timeout: 10_000 });
  });

  test('image generation stores images served from /api/images/', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByLabel('App Name').fill('Icon Demo App');
    // Add a feature so a feature image is produced alongside the icon.
    const featureInput = page.getByPlaceholder(/feature/i).first();
    if (await featureInput.isVisible().catch(() => false)) {
      await featureInput.fill('Real-time inventory sync');
    }

    // Real server-side generation through the Pollinations stub.
    await page.getByRole('button', { name: 'Generate Images' }).first().click();

    // Gallery should render a normalized icon at the exact Shopify spec.
    await expect(page.getByText('1200×1200')).toBeVisible({ timeout: 30_000 });

    // At least one gallery image must be served from the same-origin store.
    // next/image encodes the src into the optimizer URL, so match the encoded form.
    const imgSrcs = await page
      .locator('img')
      .evaluateAll((els) => els.map((el) => (el as HTMLImageElement).getAttribute('src') || ''));
    expect(imgSrcs.some((src) => /%2Fapi%2Fimages%2F|\/api\/images\//.test(src))).toBeTruthy();
  });

  test('stateless export downloads a zip with real spec-exact PNGs', async ({ page }) => {
    await page.goto('/dashboard');

    // Fill enough to clear the export progress gate (>=80%).
    await page.getByLabel('App Name').fill('Export Demo');
    await page.getByLabel('App Introduction (Tagline)').fill('Export tagline');
    await page.getByLabel('App Description').fill('A description long enough to satisfy the form.');
    const featureInput = page.getByPlaceholder(/feature/i).first();
    if (await featureInput.isVisible().catch(() => false)) {
      await featureInput.fill('Automated reports');
    }

    // Generate images (icon + feature) via the stub so the store has real bytes.
    await page.getByRole('button', { name: 'Generate Images' }).first().click();
    await expect(page.getByText('1200×1200')).toBeVisible({ timeout: 30_000 });

    const exportButton = page.getByRole('button', { name: /export package/i });
    await expect(exportButton).toBeEnabled({ timeout: 10_000 });

    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);

    expect(download.suggestedFilename()).toMatch(/\.zip$/i);

    const dest = path.join(os.tmpdir(), `shopgenfy-e2e-${Date.now()}.zip`);
    await download.saveAs(dest);
    try {
      const zip = new AdmZip(dest);
      const names = zip.getEntries().map((e) => e.entryName);

      expect(names.some((n) => n.includes('metadata.json'))).toBeTruthy();
      const iconEntry = zip.getEntries().find((e) => /images\/icon\.png$/i.test(e.entryName));
      expect(iconEntry, 'zip should contain images/icon.png').toBeTruthy();

      // Real PNG bytes — verify the PNG magic number.
      const iconBytes = iconEntry!.getData();
      expect(iconBytes.length).toBeGreaterThan(8);
      expect(Array.from(iconBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    } finally {
      fs.rmSync(dest, { force: true });
    }
  });

  test('settings screenshot-source card selects folder mode', async ({ page }) => {
    await page.goto('/settings');

    // CardTitle renders as a styled <div>, not a semantic heading.
    await expect(page.getByText('Screenshot Source', { exact: true })).toBeVisible();

    const folderOption = page.getByRole('radio', { name: /folder/i });
    await folderOption.click();
    await expect(folderOption).toHaveAttribute('aria-checked', 'true');

    // Persisted client-side so the dashboard honors it even with the DB down.
    const stored = await page.evaluate(() => localStorage.getItem('shopgenfy_screenshot_source'));
    expect(stored).toBe('folder');
  });
});
