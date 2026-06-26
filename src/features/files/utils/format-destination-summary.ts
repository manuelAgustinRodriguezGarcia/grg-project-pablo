import type { UploadedFileLatestJobSummary, UploadedFileListItem } from "@/features/files/types/uploaded-file.types";
import { DESTINATION_TYPE_LABELS } from "@/features/files/data/status-labels";

export function formatDestinationSummary(
  latestJob: UploadedFileLatestJobSummary | null,
): { primary: string; secondary: string } {
  if (!latestJob) {
    return { primary: "—", secondary: "Sin importación finalizada" };
  }

  if (!latestJob.catalog && !latestJob.folder) {
    return { primary: "—", secondary: "Destino pendiente" };
  }

  const catalogName = latestJob.catalog?.name ?? "—";
  const folderName = latestJob.folder?.name;

  return {
    primary: catalogName,
    secondary: folderName ? `Carpeta: ${folderName}` : "Sin carpeta asignada",
  };
}

export function formatDestinationTypeLabel(
  destinationType: UploadedFileListItem["destinationType"],
): string {
  return DESTINATION_TYPE_LABELS[destinationType] ?? destinationType;
}

export function formatImportMetrics(
  latestJob: UploadedFileLatestJobSummary | null,
): string {
  if (!latestJob) {
    return "—";
  }

  const parts = [`${latestJob.productsCreated} creados`];

  if (latestJob.productsSkipped > 0) {
    parts.push(`${latestJob.productsSkipped} omitidos`);
  }

  if (latestJob.errorCount > 0) {
    parts.push(`${latestJob.errorCount} errores`);
  }

  return parts.join(" · ");
}
