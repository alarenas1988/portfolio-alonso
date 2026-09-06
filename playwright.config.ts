import { defineConfig } from '@playwright/test';

// The host may inject NO_COLOR while Playwright colors child output.
// Remove both host overrides before Playwright starts workers and the preview server.
delete process.env.NO_COLOR;
delete process.env.FORCE_COLOR;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4322/portfolio-alonso/', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, hasTouch: true } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1024', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'desktop-1920', use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4322',
    url: 'http://127.0.0.1:4322/portfolio-alonso/',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_SITE_URL: 'https://example.com/portfolio-alonso/',
      ASTRO_TELEMETRY_DISABLED: '1',
      ASTRO_PREVIEW_BACKGROUND: '0',
    },
  },
});
