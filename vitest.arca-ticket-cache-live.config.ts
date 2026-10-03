import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config exclusiva del live test de cache del Ticket WSAA.
 * `pnpm test:run` no incluye test/integration.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.join(rootDir, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/arca/ticket-cache-live.test.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
