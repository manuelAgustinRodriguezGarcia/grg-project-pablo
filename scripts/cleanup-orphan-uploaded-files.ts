import "dotenv/config";
import { uploadedFileRepository } from "../src/server/repositories/uploaded-file.repository";
import { prisma } from "../src/server/database/prisma";
import {
  hasRetainedImport,
  uploadedFileRetentionService,
} from "../src/server/services/uploaded-file-retention";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const files = await uploadedFileRepository.findAllWithHistory();
  const orphans = files.filter((file) => !hasRetainedImport(file.importJobs));

  console.log(
    dryRun
      ? `[dry-run] Archivos escaneados: ${files.length}. Sin importación confirmada: ${orphans.length}.`
      : `Archivos escaneados: ${files.length}. Sin importación confirmada a eliminar: ${orphans.length}.`,
  );

  if (orphans.length === 0) {
    console.log("No hay archivos residuales para limpiar.");
    return;
  }

  let deleted = 0;

  for (const file of orphans) {
    console.log(`- ${file.originalName} (${file.id})`);

    if (dryRun) {
      continue;
    }

    const purged = await uploadedFileRetentionService.purgeIfWithoutRetainedImport(file.id);
    if (purged) {
      deleted += 1;
    }
  }

  if (dryRun) {
    console.log("Ejecutá sin --dry-run para eliminar estos archivos.");
  } else {
    console.log(`Limpieza completada. Eliminados: ${deleted}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
