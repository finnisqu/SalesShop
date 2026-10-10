import { defineConfig, devices } from '@playwright/test';

/**
 * Batch 10B runs against Vite's LOCAL demo mode, never a live customer account.
 * Keep e2e files outside src and named *.pw.ts so Vitest does not collect them.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  retries: 0, // deterministic local demo; diagnose failures without a long retry storm
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'artifacts/playwright-report' }]],
  outputDir: 'artifacts/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-320', use: { ...devices['iPhone 13'], viewport: { width: 320, height: 700 }, deviceScaleFactor: 1, browserName: 'chromium' } },
    { name: 'phone-390', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, browserName: 'chromium' } },
    { name: 'phone-430', use: { ...devices['iPhone 13'], viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, browserName: 'chromium' } },
    { name: 'phone-landscape', use: { ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, browserName: 'chromium' } },
    { name: 'tablet-768', use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, browserName: 'chromium' } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 }, browserName: 'chromium' } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --no-open',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // An explicit local-only demo; never give Playwright cloud credentials.
      VITE_SALES_SHOP_LOCAL_QC: '1',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_BASE_PATH: '/',
    },
  },
});
