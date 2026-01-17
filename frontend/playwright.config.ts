import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  // Playwright сам поднимет сервера
  webServer: [
    {
      // backend (использует .env.test)
      command:
        "cross-env NODE_ENV=test DOTENV_CONFIG_PATH=../backend/.env.test node ../backend/src/server.js",
      url: "http://localhost:8787/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // frontend
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
