import { z } from "zod";

export const priceListIdSchema = z.object({
  id: z.string().min(1, "ID requerido."),
});

export const createPriceListSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio.").max(200),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  visibleToNormalUser: z.boolean().optional(),
});

export const updatePriceListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  visibleToNormalUser: z.boolean().optional(),
});

export const priceItemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().optional(),
});

export const createPriceItemSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export const updatePriceItemSchema = createPriceItemSchema;

export const priceColumnDataTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "FORMULA",
  "UNKNOWN",
]);

export const createPriceColumnSchema = z.object({
  originalName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  internalKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guiones bajos."),
  dataType: priceColumnDataTypeSchema.optional(),
  order: z.number().int().min(0).optional(),
  visibleToNormalUser: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isAdminEditable: z.boolean().optional(),
  isPrimaryCode: z.boolean().optional(),
  isDescription: z.boolean().optional(),
  isPrice: z.boolean().optional(),
});

export const reorderPriceColumnsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const updatePriceColumnSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(200).optional(),
  visibleToNormalUser: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isPrimaryCode: z.boolean().optional(),
  isDescription: z.boolean().optional(),
  isPrice: z.boolean().optional(),
  helpText: z.string().max(2000).nullable().optional(),
});

export const setPriceImportDestinationSchema = z.object({
  destinationType: z.literal("PRICE_LIST"),
  priceListId: z.string().min(1),
  sheetName: z.string().min(1),
});
