import { defineConfig } from '@playwright/test';
delete process.env.NO_COLOR;
delete process.env.FORCE_COLOR;
export default defineConfig({
  testDir: './tests/admin-e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: 'list',
  globalTeardown: './tests/admin-e2e/teardown.mjs',
  use: {
    baseURL: 'http://localhost:4321/portfolio-alonso/',
    trace: 'off',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'node scripts/serve-admin-tests.mjs',
    url: 'http://localhost:4321/portfolio-alonso/admin/login/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
