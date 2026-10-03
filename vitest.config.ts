import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": path.join(rootDir, "test/stubs/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "backend-unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
          exclude: ["node_modules", ".next", "out", "dist", "test/integration/**"],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
          exclude: ["node_modules", ".next", "out", "dist"],
        },
      },
    ],
  },
});
