import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

type SharpModule = typeof import("sharp").default;

let sharpModule: SharpModule | null = null;

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL)
  );
}

/**
 * Local/dev fallback only. Turbopack on win32 can break a direct sharp import;
 * loading via a plain CJS file avoids that interceptor.
 *
 * Never used in production: NFT may copy this file into /var/task, but requiring
 * sharp through it leaves transitive deps (detect-libc, etc.) out of the lambda.
 */
function loadSharpViaCjsHelper(): SharpModule | null {
  // Build the path at runtime so production tracers are less likely to treat it
  // as a static include that keeps the helper alive in serverless bundles.
  const helperRelativePath = ["src", "server", "image-processors", "load-sharp.cjs"].join(
    "/",
  );
  const helperAbsolutePath = path.join(process.cwd(), helperRelativePath);
  if (!fs.existsSync(helperAbsolutePath)) {
    return null;
  }

  const requireFromProject = createRequire(
    path.join(process.cwd(), "package.json"),
  );
  const { getSharp } = requireFromProject(`./${helperRelativePath}`) as {
    getSharp: () => SharpModule;
  };
  return getSharp();
}

async function loadSharpViaImport(): Promise<SharpModule> {
  const mod = await import("sharp");
  return mod.default;
}

export async function loadSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    if (isProductionRuntime()) {
      sharpModule = await loadSharpViaImport();
    } else {
      try {
        sharpModule = await loadSharpViaImport();
      } catch {
        const fromCjs = loadSharpViaCjsHelper();
        if (!fromCjs) {
          throw new Error(
            "No se pudo cargar sharp. Reintente tras reiniciar el servidor de desarrollo.",
          );
        }
        sharpModule = fromCjs;
      }
    }
  }

  return sharpModule;
}
