import { describe, expect, it } from "vitest";
import type {
  SearchMatchType,
  SearchResultItem,
} from "@/features/catalog/types/global-search.types";
import { resolveFolderSearchSeed } from "@/features/catalog/utils/resolve-folder-search-seed";

function makeItem(
  overrides: Partial<
    Pick<SearchResultItem, "matchValue" | "primaryCode" | "matchType">
  >,
): SearchResultItem {
  return {
    productId: "p1",
    primaryCode: overrides.primaryCode ?? null,
    description: null,
    matchType: overrides.matchType ?? "primaryCode",
    matchValue: overrides.matchValue ?? "",
    catalog: { id: "c1", name: "Cat" },
    folder: { id: "f1", name: "Folder" },
    primaryImage: null,
  };
}

describe("resolveFolderSearchSeed", () => {
  it("uses primaryCode for primaryCode matches", () => {
    expect(
      resolveFolderSearchSeed(
        makeItem({
          matchType: "primaryCode",
          matchValue: "ABC-12",
          primaryCode: "ABC-12",
        }),
        "ab",
      ),
    ).toBe("ABC-12");
  });

  it("uses equivalence matchValue for equivalence matches", () => {
    expect(
      resolveFolderSearchSeed(
        makeItem({
          matchType: "equivalence",
          matchValue: "EQ-99",
          primaryCode: "PRIMARY",
        }),
        "eq",
      ),
    ).toBe("EQ-99");
  });

  it("prefers primaryCode over long column matchValues", () => {
    expect(
      resolveFolderSearchSeed(
        makeItem({
          matchType: "column",
          matchValue: "M.B. OM924 ATEGO 1726 1729 2426",
          primaryCode: "OM924-1",
        }),
        "om924",
      ),
    ).toBe("OM924-1");
  });

  it("falls back to the global query for column matches without primaryCode", () => {
    expect(
      resolveFolderSearchSeed(
        makeItem({
          matchType: "column",
          matchValue: "M.B. OM924 ATEGO 1726 1729 2426",
          primaryCode: null,
        }),
        "  om924  ",
      ),
    ).toBe("om924");
  });

  it("falls back to matchValue when nothing else is available", () => {
    expect(
      resolveFolderSearchSeed(
        makeItem({
          matchType: "description" as SearchMatchType,
          matchValue: "filtro aceite",
          primaryCode: null,
        }),
        "",
      ),
    ).toBe("filtro aceite");
  });
});
