import { z } from "zod";

export const importJobIdSchema = z.object({
  jobId: z.string().min(1, "jobId es obligatorio."),
});

export const importDestinationSchema = z.object({
  jobId: z.string().min(1),
  catalogId: z.string().min(1),
  folderId: z.string().min(1),
  sheetName: z.string().min(1),
});

export const columnMappingEntrySchema = z.object({
  headerInternalKey: z.string().min(1),
  folderColumnInternalKey: z.string().min(1),
});

export const importConfigSchema = z.object({
  jobId: z.string().min(1),
  columnMapping: z.array(columnMappingEntrySchema).optional(),
  primaryCodeColumnKey: z.string().min(1).optional(),
  descriptionColumnKey: z.string().min(1).optional(),
});

export const importApplySchema = z.object({
  jobId: z.string().min(1),
  actionType: z.enum(["IMPORTAR_LISTA", "COMBINAR_LISTA", "REEMPLAZAR_LISTA"]),
  confirmed: z.boolean(),
});

export const importPreviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ImportDestinationInput = z.infer<typeof importDestinationSchema>;
export type ImportConfigInput = z.infer<typeof importConfigSchema>;
export type ImportApplyInput = z.infer<typeof importApplySchema>;
