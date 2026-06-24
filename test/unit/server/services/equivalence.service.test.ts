import { beforeEach, describe, expect, it, vi } from "vitest";
import { equivalentCodeRepository } from "@/server/repositories/equivalent-code.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { equivalenceService } from "@/server/services/equivalence.service";
import { EquivalenceError } from "@/server/services/equivalence.errors";
import {
  adminUserFixture,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { createProductFixture, PRODUCT_ID } from "../../../helpers/fixtures/product.fixture";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

vi.mock("@/server/auth", () => ({
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: { findById: vi.fn() },
}));
vi.mock("@/server/repositories/equivalent-code.repository", () => ({
  equivalentCodeRepository: {
    findByProductId: vi.fn(),
    deleteByProductId: vi.fn(),
    createMany: vi.fn(),
    findByIdAndProduct: vi.fn(),
    deleteById: vi.fn(),
    copyToProduct: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: { logOperationSafe: vi.fn() },
}));

describe("EquivalenceService", () => {
  const columns = [
    createColumnFixture({
      internalKey: "equivalencias",
      isEquivalence: true,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(productRepository.findById).mockResolvedValue(createProductFixture());
    vi.mocked(equivalentCodeRepository.deleteByProductId).mockResolvedValue(0);
    vi.mocked(equivalentCodeRepository.createMany).mockResolvedValue(2);
    vi.mocked(equivalentCodeRepository.findByProductId).mockResolvedValue([
      {
        id: "eq-1",
        productId: PRODUCT_ID,
        originalCode: "2902",
        normalizedCode: "2902",
        sourceColumnKey: "equivalencias",
        createdAt: new Date("2026-06-24T00:00:00.000Z"),
        updatedAt: new Date("2026-06-24T00:00:00.000Z"),
      },
      {
        id: "eq-2",
        productId: PRODUCT_ID,
        originalCode: "1408",
        normalizedCode: "1408",
        sourceColumnKey: "equivalencias",
        createdAt: new Date("2026-06-24T00:00:00.000Z"),
        updatedAt: new Date("2026-06-24T00:00:00.000Z"),
      },
    ]);
  });

  it("sincroniza equivalencias desde columnas dinámicas", async () => {
    const result = await equivalenceService.syncFromProduct(PRODUCT_ID, columns, {
      equivalencias: "2902=1408",
    });

    expect(equivalentCodeRepository.deleteByProductId).toHaveBeenCalledWith(PRODUCT_ID);
    expect(equivalentCodeRepository.createMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("agrega una equivalencia manual", async () => {
    vi.mocked(equivalentCodeRepository.findByProductId)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "eq-new",
          productId: PRODUCT_ID,
          originalCode: "0193-SILVA",
          normalizedCode: "0193SILVA",
          sourceColumnKey: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

    const result = await equivalenceService.addManual(PRODUCT_ID, "0193-SILVA");

    expect(result.normalizedCode).toBe("0193SILVA");
  });

  it("rechaza equivalencias duplicadas", async () => {
    vi.mocked(equivalentCodeRepository.findByProductId).mockResolvedValue([
      {
        id: "eq-1",
        productId: PRODUCT_ID,
        originalCode: "2902",
        normalizedCode: "2902",
        sourceColumnKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(equivalenceService.addManual(PRODUCT_ID, "2902")).rejects.toBeInstanceOf(
      EquivalenceError,
    );
  });

  it("elimina una equivalencia", async () => {
    vi.mocked(equivalentCodeRepository.findByIdAndProduct).mockResolvedValue({
      id: "eq-1",
      productId: PRODUCT_ID,
      originalCode: "2902",
      normalizedCode: "2902",
      sourceColumnKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await equivalenceService.remove("eq-1", PRODUCT_ID);

    expect(equivalentCodeRepository.deleteById).toHaveBeenCalledWith("eq-1");
  });
});
