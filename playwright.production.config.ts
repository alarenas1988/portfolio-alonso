import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/production',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'https://alarenas1988.github.io/portfolio-alonso/',
    trace: 'off',
    extraHTTPHeaders: { DNT: '1', 'Sec-GPC': '1' },
  },
  projects: [
    { name: 'production-mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'production-desktop', use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
