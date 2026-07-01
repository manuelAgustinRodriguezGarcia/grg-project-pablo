import { z } from "zod";

export const productPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  includeFullUrls: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
});

export type ProductPaginationQuery = z.infer<typeof productPaginationQuerySchema>;

export const productValuesSchema = z.record(z.string(), z.unknown());

export const createProductBodySchema = z.object({
  values: productValuesSchema,
});

export const updateProductBodySchema = z.object({
  values: productValuesSchema,
});

export const productIdParamSchema = z.object({
  productId: z.string().min(1),
});

export const addEquivalenceBodySchema = z.object({
  originalCode: z.string().min(1, "El código es obligatorio."),
});

export const updateProductImageBodySchema = z
  .object({
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    label: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.isPrimary !== undefined ||
      value.sortOrder !== undefined ||
      value.label !== undefined,
    { message: "Debe enviar al menos un campo para actualizar." },
  );

export const createProductInputSchema = z.object({
  folderId: z.string().min(1),
  values: productValuesSchema,
});

export const updateProductInputSchema = z.object({
  productId: z.string().min(1),
  values: productValuesSchema,
});

export const equivalenceIdParamSchema = z.object({
  productId: z.string().min(1),
  equivalenceId: z.string().min(1),
});

export const productImageIdParamSchema = z.object({
  productId: z.string().min(1),
  imageId: z.string().min(1),
});

export const addEquivalenceInputSchema = z.object({
  productId: z.string().min(1),
  originalCode: z.string().min(1, "El código es obligatorio."),
});

export const updateProductImageInputSchema = z
  .object({
    productId: z.string().min(1),
    imageId: z.string().min(1),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    label: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.isPrimary !== undefined ||
      value.sortOrder !== undefined ||
      value.label !== undefined,
    { message: "Debe enviar al menos un campo para actualizar." },
  );
