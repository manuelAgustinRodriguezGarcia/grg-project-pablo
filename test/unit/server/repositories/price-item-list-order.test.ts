import { describe, expect, it } from "vitest";
import {
  PRICE_ITEM_LIST_ORDER_BY,
  PRICE_ITEM_LIST_ORDER_BY_SQL,
} from "@/server/repositories/price-item-list-order";

type ListedItem = {
  id: string;
  code: string;
  sourceRow: number | null;
  createdAt: Date;
  updatedAt: Date;
  marca?: string;
};

/**
 * Misma regla que PRICE_ITEM_LIST_ORDER_BY / PRICE_ITEM_LIST_ORDER_BY_SQL.
 * Sirve para fijar el orden visible sin una base de datos.
 */
function sortForList(items: ListedItem[]): ListedItem[] {
  return [...items].sort((left, right) => {
    const leftMissing = left.sourceRow === null;
    const rightMissing = right.sourceRow === null;
    if (leftMissing !== rightMissing) {
      return leftMissing ? 1 : -1;
    }

    if (
      left.sourceRow !== null &&
      right.sourceRow !== null &&
      left.sourceRow !== right.sourceRow
    ) {
      return left.sourceRow - right.sourceRow;
    }

    const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }

    if (left.id < right.id) {
      return -1;
    }
    if (left.id > right.id) {
      return 1;
    }
    return 0;
  });
}

function item(
  id: string,
  code: string,
  sourceRow: number | null,
  createdAt: string,
  updatedAt = createdAt,
  marca?: string,
): ListedItem {
  return {
    id,
    code,
    sourceRow,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    marca,
  };
}

describe("PRICE_ITEM_LIST_ORDER_BY", () => {
  it("ordena por sourceRow ASC con nulos al final y desempata por createdAt e id", () => {
    expect(PRICE_ITEM_LIST_ORDER_BY).toEqual([
      { sourceRow: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
      { id: "asc" },
    ]);

    const sql = PRICE_ITEM_LIST_ORDER_BY_SQL as { sql?: string; strings?: string[] };
    const text = sql.sql ?? sql.strings?.join("") ?? "";
    expect(text).toBe(`"sourceRow" ASC NULLS LAST, "createdAt" ASC, "id" ASC`);
  });

  it("respeta un orden distinto del alfabético y los huecos de filas vacías", () => {
    const rows = [
      item("c", "AAA", 9, "2026-01-03T00:00:00.000Z"),
      item("a", "ZZZ", 2, "2026-01-01T00:00:00.000Z"),
      item("b", "MMM", 5, "2026-01-02T00:00:00.000Z"),
    ];

    expect(sortForList(rows).map((row) => row.code)).toEqual(["ZZZ", "MMM", "AAA"]);
    expect(sortForList(rows).map((row) => row.sourceRow)).toEqual([2, 5, 9]);
  });

  it("pagina sin mezclar el orden", () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      item(
        `id-${String(index).padStart(3, "0")}`,
        `Z-${String(60 - index).padStart(3, "0")}`,
        index + 2,
        "2026-01-01T00:00:00.000Z",
      ),
    );
    const ordered = sortForList(rows);
    const pageSize = 50;

    expect(ordered.slice(0, pageSize).map((row) => row.sourceRow)).toEqual(
      Array.from({ length: pageSize }, (_, index) => index + 2),
    );
    expect(ordered.slice(pageSize, pageSize * 2).map((row) => row.sourceRow)).toEqual([
      52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
    ]);
  });

  it("la búsqueda y los filtros recortan filas sin cambiar el orden relativo", () => {
    const rows = [
      item("a", "FILTRO-Z", 2, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "Bosch"),
      item("b", "BOMBA", 5, "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z", "Mahle"),
      item("c", "FILTRO-A", 9, "2026-01-03T00:00:00.000Z", "2026-01-03T00:00:00.000Z", "Bosch"),
    ];
    const ordered = sortForList(rows);
    const searched = ordered.filter((row) => row.code.includes("FILTRO"));
    const filtered = ordered.filter((row) => row.marca === "Bosch");

    expect(searched.map((row) => row.code)).toEqual(["FILTRO-Z", "FILTRO-A"]);
    expect(filtered.map((row) => row.code)).toEqual(["FILTRO-Z", "FILTRO-A"]);
    expect(sortForList(rows).map((row) => row.code)).toEqual(["FILTRO-Z", "BOMBA", "FILTRO-A"]);
  });

  it("editar un artículo no cambia su posición", () => {
    const rows = [
      item("a", "ZZZ", 2, "2026-01-01T00:00:00.000Z"),
      item("b", "AAA", 5, "2026-01-02T00:00:00.000Z"),
    ];
    rows[1] = {
      ...rows[1]!,
      code: "AAA-EDIT",
      updatedAt: new Date("2026-11-09T00:00:00.000Z"),
    };

    expect(sortForList(rows).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("los artículos manuales y las listas viejas quedan después, por createdAt e id", () => {
    const imported = item("imp", "ZZZ", 2, "2026-01-01T00:00:00.000Z");
    const manualLater = item("man-2", "MANUAL-B", null, "2026-03-02T00:00:00.000Z");
    const manualEarlier = item("man-1", "MANUAL-A", null, "2026-03-01T00:00:00.000Z");
    const legacyLate = item("old-b", "VIEJO-B", null, "2026-01-02T00:00:00.000Z", "2026-08-01T00:00:00.000Z");
    const legacyEarlyTie = item("old-a", "VIEJO-Z", null, "2026-01-02T00:00:00.000Z");

    expect(
      sortForList([manualLater, legacyLate, imported, manualEarlier, legacyEarlyTie]).map(
        (row) => row.id,
      ),
    ).toEqual(["imp", "old-a", "old-b", "man-1", "man-2"]);
  });

  it("al combinar, la fila nueva se intercala por sourceRow y la vieja sin fila queda al final", () => {
    const legacy = item("old", "AAA", null, "2026-01-01T00:00:00.000Z");
    const added = item("new", "BBB", 6, "2026-11-01T00:00:00.000Z");
    const alreadyPositioned = item("kept", "CCC", 10, "2026-02-01T00:00:00.000Z");

    expect(sortForList([legacy, added, alreadyPositioned]).map((row) => row.id)).toEqual([
      "new",
      "kept",
      "old",
    ]);
  });
});
