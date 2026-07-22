import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

type SharpModule = typeof import("sharp").default;

const SHARP_CJS_HELPER = "./src/server/image-processors/load-sharp.cjs";

let sharpModule: SharpModule | null = null;

function loadSharpViaCjsHelper(): SharpModule | null {
  const helperAbsolutePath = path.join(process.cwd(), SHARP_CJS_HELPER);
  if (!fs.existsSync(helperAbsolutePath)) {
    return null;
  }

  // Local/dev: load through a plain CJS helper so Turbopack does not intercept
  // the native binding with its external-module loader (broken on win32).
  const requireFromProject = createRequire(
    path.join(process.cwd(), "package.json"),
  );
  const { getSharp } = requireFromProject(SHARP_CJS_HELPER) as {
    getSharp: () => SharpModule;
  };
  return getSharp();
}

/**
 * Production/serverless path. The string literal must stay static so Next.js
 * file tracing packs `sharp` (and its deps) into the Vercel function.
 */
async function loadSharpViaImport(): Promise<SharpModule> {
  const mod = await import("sharp");
  return mod.default;
}

export async function loadSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    // On Vercel the CJS helper may still be present in /var/task (NFT copies the
    // source path), but requiring sharp through it leaves transitive deps like
    // detect-libc untraced. Always use the static import there.
    if (process.env.VERCEL) {
      sharpModule = await loadSharpViaImport();
    } else {
      sharpModule = loadSharpViaCjsHelper() ?? (await loadSharpViaImport());
    }
  }

  return sharpModule;
}
