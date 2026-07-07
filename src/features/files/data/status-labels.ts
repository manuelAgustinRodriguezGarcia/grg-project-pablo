import type { ImportActionType, ImportJobStatus } from "@/generated/prisma/client";

export type StatusBadgeVariant =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "muted";

export const IMPORT_JOB_STATUS_LABELS: Record<ImportJobStatus, string> = {
  STORED: "Almacenado",
  ANALYZING: "Analizando",
  PENDING_DESTINATION: "Pendiente de destino",
  PENDING_CONFIG: "Pendiente de configuración",
  PROCESSING: "Procesando",
  READY_TO_APPLY: "Listo para aplicar",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

export const IMPORT_JOB_STATUS_VARIANTS: Record<ImportJobStatus, StatusBadgeVariant> = {
  STORED: "neutral",
  ANALYZING: "info",
  PENDING_DESTINATION: "warning",
  PENDING_CONFIG: "warning",
  PROCESSING: "info",
  READY_TO_APPLY: "info",
  PENDING_REVIEW: "warning",
  PUBLISHED: "success",
  FAILED: "danger",
  CANCELLED: "muted",
};

export const UPLOADED_FILE_STATUS_LABELS: Record<string, string> = {
  STORED: "Almacenado",
  PROCESSING: "Procesando",
  PROCESSED: "Procesado",
  FAILED: "Fallido",
};

export const UPLOADED_FILE_STATUS_VARIANTS: Record<string, StatusBadgeVariant> = {
  STORED: "neutral",
  PROCESSING: "info",
  PROCESSED: "success",
  FAILED: "danger",
};

export const IMPORT_ACTION_TYPE_LABELS: Record<ImportActionType, string> = {
  IMPORTAR_LISTA: "Importar lista",
  COMBINAR_LISTA: "Combinar lista",
  REEMPLAZAR_LISTA: "Reemplazar lista",
};

export const DESTINATION_TYPE_LABELS = {
  CATALOG: "Catálogos",
  PRICE_LIST: "Precios",
} as const;
