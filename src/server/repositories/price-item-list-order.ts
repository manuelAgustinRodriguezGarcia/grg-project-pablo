import { Prisma } from "@/generated/prisma/client";

/**
 * Price-list table order.
 *
 * 1. sourceRow ASC NULLS LAST — worksheet row stored at import. Empty sheet
 *    rows are not inserted, so their numbers remain as gaps.
 * 2. createdAt ASC, id ASC — tie-break, and the only order for legacy or
 *    manual rows (sourceRow null). This follows insertion time. It is not
 *    the original Excel order, and it does not use updatedAt, so an edit
 *    does not move the row.
 *
 * There is no backfill. A legacy list recovers the exact sheet order only by
 * importing that workbook with REEMPLAZAR_LISTA. Replace deletes every current
 * item first, including manual rows and edits to prices, descriptions and
 * custom fields, then inserts the sheet with sourceRow set.
 *
 * COMBINAR_LISTA does not update matched codes. Their sourceRow, prices,
 * descriptions and custom fields stay as they are. Only new codes are
 * inserted, with the new sheet's row numbers. On a legacy list those new
 * rows sort before the null sourceRow rows.
 */
export const PRICE_ITEM_LIST_ORDER_BY: Prisma.PriceItemOrderByWithRelationInput[] = [
  { sourceRow: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
  { id: "asc" },
];

/** Same order as PRICE_ITEM_LIST_ORDER_BY, for the raw text-search query. */
export const PRICE_ITEM_LIST_ORDER_BY_SQL = Prisma.raw(
  `"sourceRow" ASC NULLS LAST, "createdAt" ASC, "id" ASC`,
);
