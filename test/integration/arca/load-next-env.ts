import { createRequire } from "node:module";
import path from "node:path";

type EnvLogger = {
  error: (...args: unknown[]) => void;
};

type LoadEnvConfig = (
  directory: string,
  dev?: boolean,
  log?: EnvLogger,
  forceReload?: boolean,
) => void;

const require = createRequire(import.meta.url);

const silentLog: EnvLogger = {
  error() {
    return undefined;
  },
};

/**
 * Carga .env, .env.local y el resto de archivos que usa `next dev`.
 * `@next/env` omite `.env.local` cuando NODE_ENV es test, así que esta
 * carga se hace un momento en modo development y después se restaura.
 */
export function loadNextLocalEnv(directory = process.cwd()): void {
  const nextPackageJson = require.resolve("next/package.json");
  const requireFromNext = createRequire(nextPackageJson);
  const { loadEnvConfig } = requireFromNext("@next/env") as {
    loadEnvConfig: LoadEnvConfig;
  };
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;

  env.NODE_ENV = "development";
  loadEnvConfig(path.resolve(directory), true, silentLog, true);

  if (previousNodeEnv === undefined) {
    delete env.NODE_ENV;
    return;
  }

  env.NODE_ENV = previousNodeEnv;
}
