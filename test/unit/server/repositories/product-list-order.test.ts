import { describe, expect, it } from "vitest";
import { PRODUCT_LIST_ORDER_BY } from "@/server/repositories/product-list-order";

describe("PRODUCT_LIST_ORDER_BY", () => {
  it("prioriza sourceRow ASC con nulls al final, luego updatedAt DESC", () => {
    expect(PRODUCT_LIST_ORDER_BY).toEqual([
      { sourceRow: { sort: "asc", nulls: "last" } },
      { updatedAt: "desc" },
      { id: "asc" },
    ]);
  });
});
