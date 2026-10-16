import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  webServer: { command: 'pnpm dev --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:5173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'screenshot', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
});
