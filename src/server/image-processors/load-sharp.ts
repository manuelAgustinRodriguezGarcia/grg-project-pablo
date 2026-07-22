import { createRequire } from "node:module";
import path from "node:path";

type SharpModule = typeof import("sharp").default;

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

const SHARP_CJS_HELPER = "./src/server/image-processors/load-sharp.cjs";

let sharpModule: SharpModule | null = null;

function isModuleNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "MODULE_NOT_FOUND"
  );
}

/**
 * Loads sharp through a plain CJS helper so Turbopack does not intercept
 * the native binding with its external-module loader (broken on win32 dev).
 *
 * On Vercel/serverless the `src/` tree is not present at runtime, so we fall
 * back to requiring `sharp` directly (listed in serverExternalPackages).
 */
export async function loadSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    try {
      const { getSharp } = requireFromProject(SHARP_CJS_HELPER) as {
        getSharp: () => SharpModule;
      };
      sharpModule = getSharp();
    } catch (error) {
      if (!isModuleNotFound(error)) {
        throw error;
      }

      sharpModule = requireFromProject("sharp") as SharpModule;
    }
  }

  return sharpModule;
}
