import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedSheet, ParsedSheetRow } from "@/server/importers/types";
import { ImportError } from "@/server/services/import.errors";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { priceImportService } from "@/server/services/price-import.service";
import { createPriceListFixture, PRICE_LIST_ID } from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
  requirePermission: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMINISTRADOR", email: "admin@test.com", name: "Admin" },
  })),
  requireAnyPermission: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMINISTRADOR", email: "admin@test.com", name: "Admin" },
  })),
}));

vi.mock("@/server/repositories/import-job.repository", () => ({
  importJobRepository: {
    deletePreview: vi.fn(),
    update: vi.fn(),
    upsertPreview: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-list.repository", () => ({
  priceListRepository: {
    findById: vi.fn(),
    findByIdWithItemCount: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteByPriceList: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-item.repository", () => ({
  priceItemRepository: {
    findCodesByPriceList: vi.fn(),
    countByPriceList: vi.fn(),
    deleteByPriceList: vi.fn(),
    createMany: vi.fn(),
  },
}));
vi.mock("@/server/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));

const sheetFixture = {
  sheetName: "Precios",
  classification: "IMPORTABLE" as const,
  classificationReason: "Hoja de prueba",
  headerRow: 1,
  imageCount: 0,
  imagesByRow: {},
  headers: [
    {
      originalName: "Codigo",
      internalKey: "codigo",
      columnIndex: 0,
      inferredDataType: "TEXT" as const,
    },
    {
      originalName: "Precio",
      internalKey: "precio",
      columnIndex: 1,
      inferredDataType: "NUMBER" as const,
    },
  ],
  rows: [
    {
      rowNumber: 2,
      cells: {
        codigo: "A-1",
        precio: "100",
      },
      originalText: "A-1 | 100",
      formulas: [],
      warnings: [],
    },
  ],
  columnCount: 2,
  rowCount: 1,
  embeddedImageSummary: {
    embeddedImagesDetected: 0,
    rowsWithEmbeddedImages: 0,
    productsWithMultipleEmbeddedImages: 0,
  },
};

describe("PriceImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const listFixture = createPriceListFixture();
    vi.mocked(priceListRepository.findById).mockResolvedValue(listFixture);
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...listFixture,
      itemCount: 0,
    });
    vi.mocked(priceListRepository.update).mockResolvedValue(listFixture);
    vi.mocked(importJobRepository.update).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([]);
    vi.mocked(priceItemRepository.findCodesByPriceList).mockResolvedValue([]);
    vi.mocked(priceItemRepository.countByPriceList).mockResolvedValue(0);
    vi.mocked(priceItemRepository.createMany).mockResolvedValue(1);
    vi.mocked(priceItemRepository.deleteByPriceList).mockResolvedValue(0);
  });

  it("setDestination configura PRICE_LIST y limpia preview previo", async () => {
    await priceImportService.setDestination("job-1", {
      priceListId: PRICE_LIST_ID,
      sheetName: "Precios",
      supplierName: "Proveedor Test",
      supplierDate: "2026-07-07",
    });

    expect(importJobRepository.deletePreview).toHaveBeenCalledWith("job-1");
    expect(priceListRepository.update).toHaveBeenCalledWith(
      PRICE_LIST_ID,
      expect.objectContaining({
        supplierName: "Proveedor Test",
      }),
    );
    expect(importJobRepository.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        destinationType: "PRICE_LIST",
        priceListId: PRICE_LIST_ID,
        folderId: null,
        targetSheetName: "Precios",
      }),
    );
  });

  it("buildPreview genera resumen de ítems sin persistir columnas", async () => {
    const result = await priceImportService.buildPreview(
      "job-1",
      sheetFixture,
      PRICE_LIST_ID,
      {},
    );

    expect(priceColumnRepository.createMany).not.toHaveBeenCalled();
    expect(priceColumnRepository.deleteByPriceList).not.toHaveBeenCalled();
    expect(importJobRepository.upsertPreview).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("apply IMPORTAR_LISTA persiste columnas en la lista destino", async () => {
    await priceImportService.apply(
      "job-1",
      { actionType: "IMPORTAR_LISTA", confirmed: true },
      "admin-1",
      sheetFixture,
      PRICE_LIST_ID,
      {},
      [],
    );

    expect(priceColumnRepository.createMany).toHaveBeenCalled();
    expect(priceItemRepository.createMany).toHaveBeenCalled();
  });

  it("apply REEMPLAZAR_LISTA reemplaza columnas e ítems de la lista destino", async () => {
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...createPriceListFixture(),
      itemCount: 42,
    });
    vi.mocked(priceItemRepository.deleteByPriceList).mockResolvedValue(42);

    await priceImportService.apply(
      "job-1",
      { actionType: "REEMPLAZAR_LISTA", confirmed: true },
      "admin-1",
      sheetFixture,
      PRICE_LIST_ID,
      {},
      [],
    );

    expect(priceItemRepository.deleteByPriceList).toHaveBeenCalledWith(PRICE_LIST_ID);
    expect(priceColumnRepository.deleteByPriceList).toHaveBeenCalledWith(PRICE_LIST_ID);
    expect(priceColumnRepository.createMany).toHaveBeenCalled();
    expect(priceItemRepository.createMany).toHaveBeenCalled();
    expect(importJobRepository.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        status: "PUBLISHED",
        actionType: "REEMPLAZAR_LISTA",
      }),
    );
  });

  it("apply REEMPLAZAR_LISTA exige confirmación", async () => {
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...createPriceListFixture(),
      itemCount: 10,
    });

    await expect(
      priceImportService.apply(
        "job-1",
        { actionType: "REEMPLAZAR_LISTA", confirmed: false },
        "admin-1",
        sheetFixture,
        PRICE_LIST_ID,
        {},
        [],
      ),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<ImportError>);

    expect(priceItemRepository.deleteByPriceList).not.toHaveBeenCalled();
  });

  it("apply IMPORTAR_LISTA rechaza lista no vacía", async () => {
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...createPriceListFixture(),
      itemCount: 5,
    });

    await expect(
      priceImportService.apply(
        "job-1",
        { actionType: "IMPORTAR_LISTA", confirmed: true },
        "admin-1",
        sheetFixture,
        PRICE_LIST_ID,
        {},
        [],
      ),
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_EMPTY",
    } satisfies Partial<ImportError>);
  });

  it("guarda el rowNumber real, aunque haya huecos y el código no sea alfabético", async () => {
    mockMappedColumns();

    await priceImportService.apply(
      "job-1",
      { actionType: "IMPORTAR_LISTA", confirmed: true },
      "admin-1",
      sheetWithRows([
        row(2, "ZZZ", "Filtro", "300", "Bosch"),
        row(5, "AAA", "Bomba", "100", "Mahle"),
        row(9, "MMM", "Rulemán", "200", "SKF"),
      ]),
      PRICE_LIST_ID,
      {},
      [],
    );

    const inserted = insertedItems();
    expect(inserted.map((item) => item.sourceRow)).toEqual([2, 5, 9]);
    expect(inserted.map((item) => item.primaryCode)).toEqual(["ZZZ", "AAA", "MMM"]);
    expect(inserted.map((item) => item.description)).toEqual(["Filtro", "Bomba", "Rulemán"]);
    expect(inserted.map((item) => item.amount?.toString())).toEqual(["300", "100", "200"]);
    expect(inserted.map((item) => item.dynamicData)).toEqual([
      { marca: "Bosch" },
      { marca: "Mahle" },
      { marca: "SKF" },
    ]);
  });

  it("conserva sourceRow en cada lote de más de 500 filas", async () => {
    mockMappedColumns();
    const rows = Array.from({ length: 501 }, (_, index) =>
      row(
        index + 2,
        `ITEM-${String(500 - index).padStart(4, "0")}`,
        `Desc ${index}`,
        String(1000 + index),
        "Bosch",
      ),
    );

    await priceImportService.apply(
      "job-1",
      { actionType: "IMPORTAR_LISTA", confirmed: true },
      "admin-1",
      sheetWithRows(rows),
      PRICE_LIST_ID,
      {},
      [],
    );

    expect(priceItemRepository.createMany).toHaveBeenCalledTimes(2);
    const firstBatch = insertedBatch(0);
    const secondBatch = insertedBatch(1);
    expect(firstBatch).toHaveLength(500);
    expect(secondBatch).toHaveLength(1);
    expect(firstBatch[0]).toEqual(
      expect.objectContaining({
        sourceRow: 2,
        primaryCode: "ITEM-0500",
        description: "Desc 0",
        dynamicData: { marca: "Bosch" },
      }),
    );
    expect(firstBatch[0]?.amount?.toString()).toBe("1000");
    expect(firstBatch[499]).toEqual(
      expect.objectContaining({
        sourceRow: 501,
        primaryCode: "ITEM-0001",
      }),
    );
    expect(secondBatch[0]).toEqual(
      expect.objectContaining({
        sourceRow: 502,
        primaryCode: "ITEM-0000",
        description: "Desc 500",
      }),
    );
    expect(secondBatch[0]?.amount?.toString()).toBe("1500");
  });

  it("apply REEMPLAZAR_LISTA borra la lista y graba el orden de la hoja nueva", async () => {
    mockMappedColumns();
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...createPriceListFixture(),
      itemCount: 3,
    });

    await priceImportService.apply(
      "job-1",
      { actionType: "REEMPLAZAR_LISTA", confirmed: true },
      "admin-1",
      sheetWithRows([
        row(4, "NUEVO", "Pieza", "15", "NGK"),
        row(8, "OTRO", "Junta", "7", "Elring"),
      ]),
      PRICE_LIST_ID,
      {},
      [],
    );

    expect(priceItemRepository.deleteByPriceList).toHaveBeenCalledWith(PRICE_LIST_ID);
    const inserted = insertedItems();
    expect(inserted.map((item) => [item.primaryCode, item.sourceRow, item.description])).toEqual([
      ["NUEVO", 4, "Pieza"],
      ["OTRO", 8, "Junta"],
    ]);
    expect(inserted.map((item) => item.amount?.toString())).toEqual(["15", "7"]);
  });

  it("apply COMBINAR_LISTA no toca códigos existentes y guarda la fila de los nuevos", async () => {
    mockMappedColumns();
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue({
      ...createPriceListFixture(),
      itemCount: 1,
    });
    vi.mocked(priceItemRepository.findCodesByPriceList).mockResolvedValue([
      { id: "item-viejo", primaryCode: "AAA", normalizedCode: "AAA" },
    ]);

    await priceImportService.apply(
      "job-1",
      { actionType: "COMBINAR_LISTA", confirmed: true },
      "admin-1",
      sheetWithRows([
        row(2, "AAA", "Precio nuevo que no debe pisar", "999", "Bosch"),
        row(6, "BBB", "Agregado", "40", "SKF"),
      ]),
      PRICE_LIST_ID,
      {},
      [],
    );

    expect(priceItemRepository.deleteByPriceList).not.toHaveBeenCalled();
    const inserted = insertedItems();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual(
      expect.objectContaining({
        primaryCode: "BBB",
        description: "Agregado",
        sourceRow: 6,
        dynamicData: { marca: "SKF" },
      }),
    );
    expect(inserted[0]?.amount?.toString()).toBe("40");
    expect(inserted.some((item) => item.primaryCode === "AAA")).toBe(false);
  });
});

function insertedBatch(index: number) {
  return vi.mocked(priceItemRepository.createMany).mock.calls[index]?.[0] ?? [];
}

function insertedItems() {
  return vi.mocked(priceItemRepository.createMany).mock.calls.flatMap((call) => call[0]);
}

function mockMappedColumns(): void {
  vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([
    {
      internalKey: "codigo",
      originalName: "Codigo",
      isPrimaryCode: true,
      isDescription: false,
      isPrice: false,
      isSearchable: true,
    },
    {
      internalKey: "descripcion",
      originalName: "Descripcion",
      isPrimaryCode: false,
      isDescription: true,
      isPrice: false,
      isSearchable: true,
    },
    {
      internalKey: "precio",
      originalName: "Precio",
      isPrimaryCode: false,
      isDescription: false,
      isPrice: true,
      isSearchable: true,
    },
    {
      internalKey: "marca",
      originalName: "Marca",
      isPrimaryCode: false,
      isDescription: false,
      isPrice: false,
      isSearchable: true,
    },
  ] as never);
}

function sheetWithRows(rows: ParsedSheetRow[]): ParsedSheet {
  return {
    ...sheetFixture,
    headers: [
      {
        originalName: "Codigo",
        internalKey: "codigo",
        columnIndex: 0,
        inferredDataType: "TEXT" as const,
      },
      {
        originalName: "Descripcion",
        internalKey: "descripcion",
        columnIndex: 1,
        inferredDataType: "TEXT" as const,
      },
      {
        originalName: "Precio",
        internalKey: "precio",
        columnIndex: 2,
        inferredDataType: "NUMBER" as const,
      },
      {
        originalName: "Marca",
        internalKey: "marca",
        columnIndex: 3,
        inferredDataType: "TEXT" as const,
      },
    ],
    rows,
    columnCount: 4,
    rowCount: rows.length,
  };
}

function row(
  rowNumber: number,
  codigo: string,
  descripcion: string,
  precio: string,
  marca: string,
): ParsedSheetRow {
  return {
    rowNumber,
    cells: { codigo, descripcion, precio, marca },
    originalText: `${codigo} | ${descripcion} | ${precio} | ${marca}`,
    formulas: [],
    warnings: [],
  };
}
