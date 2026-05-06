import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5175',
    headless: false,
    slowMo: 400,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
});
