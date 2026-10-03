import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config exclusiva del live test de WSAA producción.
 * No incluye WSFE ni el resto de pruebas live.
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
    include: ["test/integration/arca/wsaa-production-live.test.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
