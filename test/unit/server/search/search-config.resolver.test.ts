import { describe, expect, it } from "vitest";
import {
  resolveFilterableKeys,
  resolveSearchableKeys,
} from "@/server/search/search-config.resolver";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";
import { createFolderFixture } from "../../../helpers/fixtures/folder.fixture";

describe("search-config.resolver", () => {
  const columns = [
    createColumnFixture({
      internalKey: "codigo",
      isSearchable: true,
      isFilterable: false,
    }),
    createColumnFixture({
      id: "col-marca",
      internalKey: "marca",
      isSearchable: true,
      isFilterable: true,
    }),
    createColumnFixture({
      id: "col-nota",
      internalKey: "nota",
      isSearchable: false,
      isFilterable: true,
    }),
  ];

  it("usa todas las columnas buscables si no hay config", () => {
    const folder = createFolderFixture({ searchConfig: null });
    expect(resolveSearchableKeys(folder, columns)).toEqual(["codigo", "marca"]);
  });

  it("respeta searchConfig de carpeta", () => {
    const folder = createFolderFixture({
      searchConfig: { columnInternalKeys: ["marca"] },
    });
    expect(resolveSearchableKeys(folder, columns)).toEqual(["marca"]);
  });

  it("respeta filterConfig de carpeta", () => {
    const folder = createFolderFixture({
      filterConfig: { columnInternalKeys: ["marca"] },
    });
    expect(resolveFilterableKeys(folder, columns)).toEqual(["marca"]);
  });
});
