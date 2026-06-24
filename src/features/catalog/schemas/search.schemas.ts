import { z } from "zod";
import { productPaginationQuerySchema } from "@/features/records/schemas/product.schemas";

export const columnFilterInputSchema = z.object({
  columnInternalKey: z.string().trim().min(1),
  operator: z.enum(["contains", "equals"]),
  value: z.string().trim().min(1).max(200),
});

export const columnFiltersQuerySchema = z
  .union([
    z.array(columnFilterInputSchema),
    z.string().transform((value, ctx) => {
      try {
        const parsed: unknown = JSON.parse(value);
        const result = z.array(columnFilterInputSchema).safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Formato de filtros inválido.",
          });
          return z.NEVER;
        }
        return result.data;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato de filtros inválido.",
        });
        return z.NEVER;
      }
    }),
  ])
  .optional();

export const folderProductListQuerySchema = productPaginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  filters: columnFiltersQuerySchema,
});

export const catalogSearchQuerySchema = productPaginationQuerySchema.extend({
  q: z.string().trim().min(1, "La consulta de búsqueda es obligatoria.").max(200),
});

export const globalSearchQuerySchema = productPaginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  catalogId: z.string().cuid().optional(),
  folderId: z.string().cuid().optional(),
  globalFieldKey: z.string().trim().min(1).optional(),
  globalFieldValue: z.string().trim().min(1).max(200).optional(),
}).refine(
  (data) =>
    Boolean(data.q?.trim()) ||
    (Boolean(data.globalFieldKey) && Boolean(data.globalFieldValue)),
  {
    message: "Debe indicar q o globalFieldKey con globalFieldValue.",
    path: ["q"],
  },
);

export type FolderProductListQuery = z.infer<typeof folderProductListQuerySchema>;
export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;
export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
