import { beforeEach, describe, expect, it, vi } from "vitest";
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
  },
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
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
    vi.mocked(priceListRepository.findById).mockResolvedValue(createPriceListFixture());
    vi.mocked(importJobRepository.update).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([]);
    vi.mocked(priceItemRepository.findCodesByPriceList).mockResolvedValue([]);
    vi.mocked(priceItemRepository.countByPriceList).mockResolvedValue(0);
    vi.mocked(priceItemRepository.createMany).mockResolvedValue(1);
  });

  it("setDestination configura PRICE_LIST y limpia preview previo", async () => {
    await priceImportService.setDestination("job-1", {
      priceListId: PRICE_LIST_ID,
      sheetName: "Precios",
    });

    expect(importJobRepository.deletePreview).toHaveBeenCalledWith("job-1");
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

  it("buildPreview genera resumen de ítems", async () => {
    const result = await priceImportService.buildPreview(
      "job-1",
      sheetFixture,
      PRICE_LIST_ID,
      {},
    );

    expect(importJobRepository.upsertPreview).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
