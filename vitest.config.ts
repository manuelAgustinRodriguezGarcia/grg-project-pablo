import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "backend-unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
          exclude: ["node_modules", ".next", "out", "dist"],
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
