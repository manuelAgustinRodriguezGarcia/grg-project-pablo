import type { ImportWizardStep } from "@/features/imports/types/import-wizard.types";

export const IMPORT_WIZARD_STEP_HINTS: Partial<Record<ImportWizardStep, string>> = {
  upload:
    "Suba un archivo de Excel para iniciar la importación.",
  destination:
    "Seleccione en qué catálogo y carpeta desea guardar la lista de productos.",
  columns:
    "Revise cómo se reconocen las columnas del Excel con la carpeta destino y ajuste el código principal y cada columna.",
  preview:
    "Revise la vista previa y confirme cómo desea aplicar la lista de productos.",
  imageReview:
    "Revise las imágenes pendientes y vincúlelas a un producto antes de finalizar. O ignorelas para continuar con la importación.",
};

export function getImportWizardStepHint(step: ImportWizardStep): string | null {
  return IMPORT_WIZARD_STEP_HINTS[step] ?? null;
}
