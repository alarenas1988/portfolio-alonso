import { defineConfig, devices } from '@playwright/test';

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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
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
