import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/integration/**/*.test.js"],
    setupFiles: ["src/tests/integration/setup-env.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
