import { z } from "zod";

export const productPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ProductPaginationQuery = z.infer<typeof productPaginationQuerySchema>;
