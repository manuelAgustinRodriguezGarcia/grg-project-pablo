import { z } from "zod";

export const folderStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const folderColumnKeysConfigSchema = z.object({
  columnInternalKeys: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Las claves de columna no pueden estar vacías."),
    )
    .max(100, "No se pueden configurar más de 100 columnas.")
    .refine(
      (keys) => new Set(keys).size === keys.length,
      "Las claves de columna no pueden repetirse.",
    ),
});

export const catalogIdParamSchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
});

export const folderIdSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
});

export const createFolderSchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(200, "El nombre no puede superar 200 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede superar 2000 caracteres.")
    .optional()
    .nullable(),
  status: folderStatusSchema.optional(),
  order: z
    .number()
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .optional(),
  visibleToNormalUser: z.boolean().optional(),
});

export const createFolderFromSheetSchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
  sheetName: z
    .string()
    .trim()
    .min(1, "El nombre de la hoja es obligatorio.")
    .max(200, "El nombre de la hoja no puede superar 200 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede superar 2000 caracteres.")
    .optional()
    .nullable(),
});

export const updateFolderSchema = z
  .object({
    id: z.string().cuid("Identificador de carpeta inválido."),
    name: z
      .string()
      .trim()
      .min(1, "El nombre no puede estar vacío.")
      .max(200, "El nombre no puede superar 200 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "La descripción no puede superar 2000 caracteres.")
      .optional()
      .nullable(),
    status: folderStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined,
    {
      message: "Debes indicar al menos el nombre, la descripción o el estado.",
      path: ["name"],
    },
  );

export const reorderFoldersSchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
  items: z
    .array(
      z.object({
        id: z.string().cuid("Identificador de carpeta inválido."),
        order: z
          .number()
          .int("El orden debe ser un número entero.")
          .min(0, "El orden no puede ser negativo."),
      }),
    )
    .min(1, "Debes indicar al menos una carpeta para reordenar."),
});

export const setFolderVisibilitySchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
  visible: z.boolean(),
});

export const setFolderSearchConfigSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
  config: folderColumnKeysConfigSchema.nullable(),
});

export const setFolderFilterConfigSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
  config: folderColumnKeysConfigSchema.nullable(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type CreateFolderFromSheetInput = z.infer<
  typeof createFolderFromSheetSchema
>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type ReorderFoldersInput = z.infer<typeof reorderFoldersSchema>;
export type SetFolderVisibilityInput = z.infer<
  typeof setFolderVisibilitySchema
>;
export type FolderColumnKeysConfigInput = z.infer<
  typeof folderColumnKeysConfigSchema
>;
