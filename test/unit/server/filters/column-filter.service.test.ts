import { describe, expect, it } from "vitest";
import { columnFilterService } from "@/server/filters/column-filter.service";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

describe("column-filter.service", () => {
  const columns = [
    createColumnFixture({
      internalKey: "montadora",
      displayName: "Montadora",
      isFilterable: true,
      dataType: "TEXT",
    }),
    createColumnFixture({
      id: "col-estrias",
      internalKey: "estrias",
      displayName: "Cant. de estrías",
      isFilterable: true,
      dataType: "NUMBER",
    }),
    createColumnFixture({
      id: "col-readonly",
      internalKey: "nota",
      displayName: "Nota",
      isFilterable: false,
    }),
  ];

  it("genera pills legibles para filtros activos", () => {
    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "montadora",
        operator: "contains",
        value: "John D",
      },
    ]);

    const pills = columnFilterService.toActiveFilterPills(filters, columns);
    expect(pills).toHaveLength(1);
    expect(pills[0]?.label).toBe('Montadora contiene "John D"');
  });

  it("combina filtros con AND", () => {
    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "montadora",
        operator: "contains",
        value: "John D",
      },
      {
        columnInternalKey: "estrias",
        operator: "equals",
        value: "19",
      },
    ]);

    const where = columnFilterService.buildFilterWhere(filters, columns);
    expect(where).toHaveProperty("AND");
  });

  it("rechaza columnas no filtrables", () => {
    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "nota",
        operator: "contains",
        value: "x",
      },
    ]);

    expect(() =>
      columnFilterService.validateFiltersForColumns(filters, columns, [
        "montadora",
        "estrias",
      ]),
    ).toThrow(/no admite filtros/);
  });
});
