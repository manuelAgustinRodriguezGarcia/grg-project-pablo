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

export const importConfigSchema = z
  .object({
    jobId: z.string().min(1),
    columnMapping: z.array(columnMappingEntrySchema).optional(),
    primaryCodeColumnKey: z.string().min(1).optional(),
    descriptionColumnKey: z.string().min(1).optional(),
    useGeneratedPrimaryCodes: z.boolean().optional(),
  })
  .superRefine((data, context) => {
    if (!data.useGeneratedPrimaryCodes && !data.primaryCodeColumnKey) {
      context.addIssue({
        code: "custom",
        message:
          "Debe seleccionar una columna código principal o activar la generación automática de códigos.",
        path: ["primaryCodeColumnKey"],
      });
    }
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

export const importImageReviewQuerySchema = z.object({
  jobId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z
    .enum([
      "ASSOCIATED_AUTO",
      "ASSOCIATED_MANUAL",
      "PENDING_REVIEW",
      "FILE_NOT_FOUND",
      "AMBIGUOUS",
      "DUPLICATE_NAME",
      "FORMAT_REJECTED",
      "DELETED",
    ])
    .optional(),
});

export const associateImportImageSchema = z.object({
  jobId: z.string().min(1),
  imageId: z.string().min(1),
  productId: z.string().min(1),
});

export const updateImportImageSchema = z.object({
  jobId: z.string().min(1),
  imageId: z.string().min(1),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  label: z.string().nullable().optional(),
});

export const deleteImportImageSchema = z.object({
  jobId: z.string().min(1),
  imageId: z.string().min(1),
});

export type ImportDestinationInput = z.infer<typeof importDestinationSchema>;
export type ImportConfigInput = z.infer<typeof importConfigSchema>;
export type ImportApplyInput = z.infer<typeof importApplySchema>;
