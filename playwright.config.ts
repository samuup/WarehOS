import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'src/test/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});