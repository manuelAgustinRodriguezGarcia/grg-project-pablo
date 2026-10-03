import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config exclusiva de la consulta live FECompConsultar.
 * `pnpm test:run` no incluye test/integration.
 * Requiere ARCA_VOUCHER_CONSULT_LIVE_TEST=1.
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
    include: ["test/integration/arca/voucher-consult-live.test.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
