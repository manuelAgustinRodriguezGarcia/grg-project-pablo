import type { PriceList } from "@/generated/prisma/client";
import type { PriceListWithItemCount } from "@/server/repositories/price-list.repository";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export const PRICE_LIST_ID = "clh3pb1a3000012345678903pl";

export function createPriceListFixture(
  overrides: Partial<PriceList> = {},
): PriceList {
  return {
    id: PRICE_LIST_ID,
    name: "Lista general",
    description: "Precios generales",
    status: "ACTIVE",
    order: 0,
    visibleToNormalUser: true,
    sourceUploadedFileId: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export function createPriceListWithItemCountFixture(
  overrides: Partial<PriceListWithItemCount> = {},
): PriceListWithItemCount {
  return {
    ...createPriceListFixture(overrides),
    itemCount: overrides.itemCount ?? 0,
  };
}
