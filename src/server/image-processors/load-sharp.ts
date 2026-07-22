type SharpModule = typeof import("sharp").default;

let sharpModule: SharpModule | null = null;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/**
 * Loads sharp for image validation/thumbnails.
 *
 * Production uses a static `import("sharp")` only — no fs/path/createRequire —
 * so Turbopack/NFT does not accidentally trace the whole project (which can
 * hang or OOM Vercel builds).
 *
 * Local Turbopack/win32 may fail that import; the optional dynamic fallback in
 * development loads sharp via a plain CJS helper outside the bundler interceptor.
 */
export async function loadSharp(): Promise<SharpModule> {
  if (sharpModule) {
    return sharpModule;
  }

  if (isProductionRuntime()) {
    const mod = await import("sharp");
    sharpModule = mod.default;
    return sharpModule;
  }

  try {
    const mod = await import("sharp");
    sharpModule = mod.default;
  } catch {
    const { loadSharpDevFallback } = await import("./load-sharp-dev-fallback");
    sharpModule = loadSharpDevFallback();
  }

  return sharpModule;
}
