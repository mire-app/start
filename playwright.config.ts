import { defineConfig, devices } from '@playwright/test';

const PORT = 4873;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/start/`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/start/`,
    reuseExistingServer: false,
  },
});
