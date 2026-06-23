import { createRequire } from "node:module";
import path from "node:path";

type SharpModule = typeof import("sharp").default;

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

let sharpModule: SharpModule | null = null;

/**
 * Loads sharp through a plain CJS helper so Turbopack does not intercept
 * the native binding with its external-module loader (broken on win32 dev).
 */
export async function loadSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    const { getSharp } = requireFromProject(
      "./src/server/image-processors/load-sharp.cjs",
    ) as { getSharp: () => SharpModule };
    sharpModule = getSharp();
  }

  return sharpModule;
}
