import { describe, expect, it } from "vitest";
import {
  serializeColumnFilters,
  toActiveFilterPillsFromState,
  upsertColumnFilter,
} from "@/features/catalog/utils/column-filter-state";

describe("column-filter-state", () => {
  it("acumula filtros de distintas columnas sin perder los anteriores", () => {
    const first = upsertColumnFilter([], "montadora", {
      columnInternalKey: "montadora",
      operator: "contains",
      value: "John",
    });

    const combined = upsertColumnFilter(first, "estrias", {
      columnInternalKey: "estrias",
      operator: "equals",
      value: "19",
    });

    expect(combined).toEqual([
      {
        columnInternalKey: "montadora",
        operator: "contains",
        value: "John",
      },
      {
        columnInternalKey: "estrias",
        operator: "equals",
        value: "19",
      },
    ]);
  });

  it("reemplaza el filtro de una columna sin afectar las demás", () => {
    const initial = [
      {
        columnInternalKey: "montadora",
        operator: "contains" as const,
        value: "John",
      },
      {
        columnInternalKey: "estrias",
        operator: "equals" as const,
        value: "19",
      },
    ];

    const updated = upsertColumnFilter(initial, "montadora", {
      columnInternalKey: "montadora",
      operator: "contains",
      value: "John Deere",
    });

    expect(updated).toHaveLength(2);
    expect(updated).toEqual(
      expect.arrayContaining([
        {
          columnInternalKey: "montadora",
          operator: "contains",
          value: "John Deere",
        },
        {
          columnInternalKey: "estrias",
          operator: "equals",
          value: "19",
        },
      ]),
    );
  });

  it("serializa filtros de forma estable para la query", () => {
    const serialized = serializeColumnFilters([
      {
        columnInternalKey: "zeta",
        operator: "contains",
        value: "1",
      },
      {
        columnInternalKey: "alpha",
        operator: "equals",
        value: "2",
      },
    ]);

    expect(serialized).toBe(
      JSON.stringify([
        {
          columnInternalKey: "alpha",
          operator: "equals",
          value: "2",
        },
        {
          columnInternalKey: "zeta",
          operator: "contains",
          value: "1",
        },
      ]),
    );
  });

  it("genera pills legibles desde el estado del cliente", () => {
    const pills = toActiveFilterPillsFromState(
      [
        {
          columnInternalKey: "montadora",
          operator: "contains",
          value: "John",
        },
        {
          columnInternalKey: "estrias",
          operator: "equals",
          value: "19",
        },
      ],
      [
        { internalKey: "montadora", displayName: "Montadora" },
        { internalKey: "estrias", displayName: "Cant. de estrías" },
      ],
    );

    expect(pills).toHaveLength(2);
    expect(pills[0]?.label).toBe('Montadora contiene "John"');
    expect(pills[1]?.label).toBe('Cant. de estrías = "19"');
  });
});
