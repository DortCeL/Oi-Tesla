import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one Postgres DB — run files sequentially.
    fileParallelism: false,
  },
});
