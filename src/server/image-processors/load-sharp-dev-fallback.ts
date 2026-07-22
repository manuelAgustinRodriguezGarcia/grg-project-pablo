import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

type SharpModule = typeof import("sharp").default;

/**
 * Dev-only sharp loader. Kept in a separate module so production bundles never
 * pull fs/path/createRequire into the serverless NFT graph.
 */
export function loadSharpDevFallback(): SharpModule {
  const helperRelativePath = ["src", "server", "image-processors", "load-sharp.cjs"].join(
    "/",
  );
  const helperAbsolutePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    helperRelativePath,
  );

  if (!fs.existsSync(helperAbsolutePath)) {
    throw new Error(
      "No se pudo cargar sharp. Reintente tras reiniciar el servidor de desarrollo.",
    );
  }

  const requireFromProject = createRequire(
    path.join(/* turbopackIgnore: true */ process.cwd(), "package.json"),
  );
  const { getSharp } = requireFromProject(`./${helperRelativePath}`) as {
    getSharp: () => SharpModule;
  };

  return getSharp();
}
