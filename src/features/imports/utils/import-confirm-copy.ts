import type { ImportActionType } from "@/generated/prisma/client";
import type { ImportPreviewSummary } from "@/features/imports/types/import-job.types";

type ImportConfirmCopyInput = {
  action: ImportActionType;
  isPriceMode: boolean;
  summary: ImportPreviewSummary | null | undefined;
  destinationName?: string;
};

type ImportConfirmCopy = {
  title: string;
  message: string;
  confirmLabel: string;
};

function getExistingCount(summary: ImportPreviewSummary | null | undefined, isPriceMode: boolean) {
  if (!summary) {
    return 0;
  }

  return isPriceMode
    ? (summary.priceListItemCount ?? 0)
    : (summary.folderProductCount ?? 0);
}

function getNewCount(summary: ImportPreviewSummary | null | undefined, isPriceMode: boolean) {
  if (!summary) {
    return 0;
  }

  return isPriceMode ? (summary.totalItems ?? 0) : (summary.totalProducts ?? 0);
}

export function getImportConfirmCopy({
  action,
  isPriceMode,
  summary,
  destinationName,
}: ImportConfirmCopyInput): ImportConfirmCopy {
  const existingCount = getExistingCount(summary, isPriceMode);
  const newCount = getNewCount(summary, isPriceMode);
  const destinationLabel = isPriceMode ? "lista de precios" : "carpeta";
  const recordLabel = isPriceMode ? "ítems" : "productos";
  const destinationNameText = destinationName ? ` "${destinationName}"` : "";

  if (action === "REEMPLAZAR_LISTA") {
    return {
      title: isPriceMode ? "Reemplazar ítems" : "Reemplazar productos",
      message: isPriceMode
        ? `Se eliminarán los ${existingCount.toLocaleString("es-AR")} ítems actuales de la lista${destinationNameText} y se reemplazarán por ${newCount.toLocaleString("es-AR")} ítems del Excel. Esta acción no se puede deshacer.`
        : `Se eliminarán los ${existingCount.toLocaleString("es-AR")} productos actuales de la carpeta${destinationNameText} y se reemplazarán por ${newCount.toLocaleString("es-AR")} productos del Excel. Esta acción no se puede deshacer.`,
      confirmLabel: "Reemplazar",
    };
  }

  return {
    title: isPriceMode ? "Combinar ítems" : "Combinar productos",
    message: isPriceMode
      ? `Se mantendrán los ${existingCount.toLocaleString("es-AR")} ítems actuales de la lista${destinationNameText} y se agregarán solo los nuevos del Excel. ¿Querés continuar?`
      : `Se mantendrán los ${existingCount.toLocaleString("es-AR")} productos actuales de la ${destinationLabel}${destinationNameText} y se agregarán solo los nuevos. ¿Querés continuar?`,
    confirmLabel: "Combinar",
  };
}
