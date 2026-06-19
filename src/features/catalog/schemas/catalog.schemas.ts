import { z } from "zod";

export const catalogStatusSchema = z.enum(["ACTIVE", "INACTIVE", "HIDDEN"]);

export const createCatalogSchema = z.object({
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
  status: catalogStatusSchema.optional(),
  order: z
    .number()
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .optional(),
  visibleToNormalUser: z.boolean().optional(),
});

export const updateCatalogSchema = z
  .object({
    id: z.string().cuid("Identificador de catálogo inválido."),
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
    status: catalogStatusSchema.optional(),
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

export const catalogIdSchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
});

export const reorderCatalogsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().cuid("Identificador de catálogo inválido."),
        order: z
          .number()
          .int("El orden debe ser un número entero.")
          .min(0, "El orden no puede ser negativo."),
      }),
    )
    .min(1, "Debes indicar al menos un catálogo para reordenar."),
});

export const setCatalogVisibilitySchema = z.object({
  catalogId: z.string().cuid("Identificador de catálogo inválido."),
  visible: z.boolean(),
});

export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;
export type UpdateCatalogInput = z.infer<typeof updateCatalogSchema>;
export type CatalogIdInput = z.infer<typeof catalogIdSchema>;
export type ReorderCatalogsInput = z.infer<typeof reorderCatalogsSchema>;
export type SetCatalogVisibilityInput = z.infer<
  typeof setCatalogVisibilitySchema
>;
