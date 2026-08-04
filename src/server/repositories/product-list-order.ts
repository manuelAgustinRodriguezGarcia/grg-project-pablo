import type { Prisma } from "@/generated/prisma/client";

/** Folder product lists: Excel order first; legacy/manual (null sourceRow) keep updatedAt desc. */
export const PRODUCT_LIST_ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { sourceRow: { sort: "asc", nulls: "last" } },
  { updatedAt: "desc" },
  { id: "asc" },
];
