import { vi } from "vitest";
import { productRepository } from "@/server/repositories/product.repository";
import { createProductFixture } from "../fixtures/product.fixture";

export function setupProductRepositoryMocks(): void {
  vi.mocked(productRepository.findPaginatedBasic).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
  });
  vi.mocked(productRepository.findById).mockResolvedValue(null);
  vi.mocked(productRepository.countByFolder).mockResolvedValue(0);
}

export function mockProductsPaginated(
  overrides: Partial<Awaited<ReturnType<typeof productRepository.findPaginatedBasic>>> = {},
): void {
  vi.mocked(productRepository.findPaginatedBasic).mockResolvedValue({
    items: [createProductFixture()],
    total: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    ...overrides,
  });
}
