import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportError } from "@/server/services/import.errors";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { priceImportService } from "@/server/services/price-import.service";
import { createPriceListFixture, PRICE_LIST_ID } from "../../../helpers/fixtures/price-list.fixture";

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
});
