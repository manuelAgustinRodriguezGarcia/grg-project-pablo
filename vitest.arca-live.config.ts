import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config exclusiva de las pruebas live de ARCA.
 * `pnpm test:run` usa vitest.config.ts, que excluye test/integration.
 * Cada script apunta a un solo archivo y exige su propia flag.
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
    include: ["test/integration/arca/**/*.test.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
