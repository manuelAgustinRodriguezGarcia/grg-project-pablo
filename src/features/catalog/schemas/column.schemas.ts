import { z } from "zod";

export const columnDataTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "IMAGE",
  "FORMULA",
  "UNKNOWN",
]);

export const folderIdParamSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
});

export const columnIdSchema = z.object({
  id: z.string().cuid("Identificador de columna inválido."),
});

export const columnIdParamSchema = z.object({
  columnId: z.string().cuid("Identificador de columna inválido."),
});

const helpTextSchema = z
  .string()
  .trim()
  .max(2000, "El texto de ayuda no puede superar 2000 caracteres.")
  .optional()
  .nullable();

const helpImageAltTextSchema = z
  .string()
  .trim()
  .max(200, "El texto alternativo no puede superar 200 caracteres.")
  .optional()
  .nullable();

export const createColumnSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
  originalName: z
    .string()
    .trim()
    .min(1, "El nombre original es obligatorio.")
    .max(200, "El nombre original no puede superar 200 caracteres."),
  displayName: z
    .string()
    .trim()
    .min(1, "El nombre visible es obligatorio.")
    .max(200, "El nombre visible no puede superar 200 caracteres."),
  internalKey: z
    .string()
    .trim()
    .min(1, "La clave interna es obligatoria.")
    .max(120, "La clave interna no puede superar 120 caracteres.")
    .regex(
      /^[a-z0-9_]+$/,
      "La clave interna solo puede contener minúsculas, números y guiones bajos.",
    ),
  dataType: columnDataTypeSchema.optional(),
  order: z
    .number()
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .optional(),
  visibleToNormalUser: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isGloballySearchable: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isGloballyFilterable: z.boolean().optional(),
  isAdminEditable: z.boolean().optional(),
  isPrimaryCode: z.boolean().optional(),
  isEquivalence: z.boolean().optional(),
  isDescription: z.boolean().optional(),
  isImageCode: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  isReadOnly: z.boolean().optional(),
  width: z
    .number()
    .int("El ancho debe ser un número entero.")
    .min(1, "El ancho debe ser mayor a cero.")
    .optional()
    .nullable(),
  format: z
    .string()
    .trim()
    .max(120, "El formato no puede superar 120 caracteres.")
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .max(40, "La unidad no puede superar 40 caracteres.")
    .optional()
    .nullable(),
  label: z
    .string()
    .trim()
    .max(120, "La etiqueta no puede superar 120 caracteres.")
    .optional()
    .nullable(),
  globalFieldKey: z
    .string()
    .trim()
    .max(120, "El campo global no puede superar 120 caracteres.")
    .optional()
    .nullable(),
  helpText: helpTextSchema,
  helpImageAltText: helpImageAltTextSchema,
});

export const updateColumnSchema = z
  .object({
    id: z.string().cuid("Identificador de columna inválido."),
    displayName: z
      .string()
      .trim()
      .min(1, "El nombre visible no puede estar vacío.")
      .max(200, "El nombre visible no puede superar 200 caracteres.")
      .optional(),
    internalKey: z
      .string()
      .trim()
      .min(1, "La clave interna no puede estar vacía.")
      .max(120, "La clave interna no puede superar 120 caracteres.")
      .regex(
        /^[a-z0-9_]+$/,
        "La clave interna solo puede contener minúsculas, números y guiones bajos.",
      )
      .optional(),
    dataType: columnDataTypeSchema.optional(),
    order: z
      .number()
      .int("El orden debe ser un número entero.")
      .min(0, "El orden no puede ser negativo.")
      .optional(),
    visibleToNormalUser: z.boolean().optional(),
    isSearchable: z.boolean().optional(),
    isGloballySearchable: z.boolean().optional(),
    isFilterable: z.boolean().optional(),
    isGloballyFilterable: z.boolean().optional(),
    isAdminEditable: z.boolean().optional(),
    isPrimaryCode: z.boolean().optional(),
    isEquivalence: z.boolean().optional(),
    isDescription: z.boolean().optional(),
    isImageCode: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    isReadOnly: z.boolean().optional(),
    width: z
      .number()
      .int("El ancho debe ser un número entero.")
      .min(1, "El ancho debe ser mayor a cero.")
      .optional()
      .nullable(),
    format: z
      .string()
      .trim()
      .max(120, "El formato no puede superar 120 caracteres.")
      .optional()
      .nullable(),
    unit: z
      .string()
      .trim()
      .max(40, "La unidad no puede superar 40 caracteres.")
      .optional()
      .nullable(),
    label: z
      .string()
      .trim()
      .max(120, "La etiqueta no puede superar 120 caracteres.")
      .optional()
      .nullable(),
    globalFieldKey: z
      .string()
      .trim()
      .max(120, "El campo global no puede superar 120 caracteres.")
      .optional()
      .nullable(),
    helpText: helpTextSchema,
    helpImageAltText: helpImageAltTextSchema,
  })
  .refine(
    (data) =>
      Object.keys(data).some((key) => key !== "id" && data[key as keyof typeof data] !== undefined),
    {
      message: "Debes indicar al menos un campo para actualizar.",
      path: ["displayName"],
    },
  );

export const reorderColumnsSchema = z.object({
  folderId: z.string().cuid("Identificador de carpeta inválido."),
  items: z
    .array(
      z.object({
        id: z.string().cuid("Identificador de columna inválido."),
        order: z
          .number()
          .int("El orden debe ser un número entero.")
          .min(0, "El orden no puede ser negativo."),
      }),
    )
    .min(1, "Debes indicar al menos una columna para reordenar."),
});

export const setColumnVisibilitySchema = z.object({
  id: z.string().cuid("Identificador de columna inválido."),
  visible: z.boolean(),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
export type SetColumnVisibilityInput = z.infer<typeof setColumnVisibilitySchema>;
