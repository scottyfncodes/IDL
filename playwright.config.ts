import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
