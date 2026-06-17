import "dotenv/config";
import {
  ALL_STORAGE_BUCKETS,
  ensureStorageBuckets,
  listStorageBuckets,
} from "../src/server/storage";

async function main(): Promise<void> {
  console.log("Configurando buckets privados de Supabase Storage…");

  await ensureStorageBuckets();

  const buckets = await listStorageBuckets();
  const missing = ALL_STORAGE_BUCKETS.filter((name) => !buckets.includes(name));

  if (missing.length > 0) {
    throw new Error(`Buckets faltantes tras la configuración: ${missing.join(", ")}`);
  }

  for (const name of ALL_STORAGE_BUCKETS) {
    console.log(`✓ Bucket privado listo: ${name}`);
  }

  console.log("Configuración de Storage completada.");
}

main().catch((error: unknown) => {
  console.error("✗ Error al configurar Storage:", error);
  process.exit(1);
});
