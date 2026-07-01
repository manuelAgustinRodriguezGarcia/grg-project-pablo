import { describe, expect, it } from "vitest";
import { columnFilterService } from "@/server/filters/column-filter.service";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

describe("column-filter.service", () => {
  const columns = [
    createColumnFixture({
      internalKey: "montadora",
      displayName: "Montadora",
      isFilterable: true,
      isPrimaryCode: false,
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

  it("combina filtros prisma con AND", () => {
    const columnsWithPrimaryCode = [
      ...columns,
      createColumnFixture({
        id: "col-codigo",
        internalKey: "codigo",
        displayName: "Código",
        isPrimaryCode: true,
        isFilterable: true,
        dataType: "TEXT",
      }),
    ];

    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "estrias",
        operator: "equals",
        value: "19",
      },
      {
        columnInternalKey: "codigo",
        operator: "contains",
        value: "6205",
      },
    ]);

    const { prismaFilters } = columnFilterService.partitionFilters(
      filters,
      columnsWithPrimaryCode,
    );

    const where = columnFilterService.buildFilterWhere(prismaFilters, columnsWithPrimaryCode);
    expect(where).toHaveProperty("AND");
  });

  it("separa filtros TEXT dinámicos para consulta ILIKE", () => {
    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "montadora",
        operator: "contains",
        value: "indiel",
      },
      {
        columnInternalKey: "estrias",
        operator: "equals",
        value: "19",
      },
    ]);

    const partitioned = columnFilterService.partitionFilters(filters, columns);

    expect(partitioned.jsonTextFilters).toEqual([
      {
        columnInternalKey: "montadora",
        operator: "contains",
        value: "indiel",
      },
    ]);
    expect(partitioned.prismaFilters).toEqual([
      {
        columnInternalKey: "estrias",
        operator: "equals",
        value: "19",
      },
    ]);
  });

  it("usa equals case-insensitive para primaryCode", () => {
    const columnsWithPrimaryCode = [
      createColumnFixture({
        id: "col-codigo",
        internalKey: "codigo",
        displayName: "Código",
        isPrimaryCode: true,
        isFilterable: true,
        dataType: "TEXT",
      }),
    ];

    const filters = columnFilterService.parseFilters([
      {
        columnInternalKey: "codigo",
        operator: "equals",
        value: "abc",
      },
    ]);

    const where = columnFilterService.buildFilterWhere(filters, columnsWithPrimaryCode);

    expect(where).toEqual({
      primaryCode: {
        equals: "abc",
        mode: "insensitive",
      },
    });
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
