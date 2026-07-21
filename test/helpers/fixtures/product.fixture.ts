import type { Product } from "@/generated/prisma/client";
import { vi } from "vitest";
import { productRepository } from "@/server/repositories/product.repository";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export const PRODUCT_ID = "clh3pb1a3000012345678904gh";

export function createProductFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    folderId: "clh3pb1a3000012345678902cd",
    primaryCode: "6205",
    normalizedCode: "6205",
    description: "Ruleman 6205",
    dynamicData: { marca: "SKF", nota_interna: "admin only" },
    originalText: null,
    indexedText: null,
    normalizedIndexedText: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export function setupProductRepositoryMocks(): void {
  vi.mocked(productRepository.findByFolderPaginated).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
  });
  vi.mocked(productRepository.findById).mockResolvedValue(null);
  vi.mocked(productRepository.countByFolder).mockResolvedValue(0);
}
