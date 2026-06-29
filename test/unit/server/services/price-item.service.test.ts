import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { priceItemService } from "@/server/services/price-item.service";
import { priceListService } from "@/server/services/price-list.service";
import {
  adminUserFixture,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { PRICE_LIST_ID } from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/price-item.repository", () => ({
  priceItemRepository: {
    findByPriceListPaginated: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
  },
}));
vi.mock("@/server/services/price-list.service", () => ({
  priceListService: {
    getPriceList: vi.fn(),
    requirePriceListForAdmin: vi.fn(),
  },
}));
vi.mock("@/server/services/visibility.service", () => ({
  visibilityService: {
    priceColumnWhereForRole: vi.fn(() => ({})),
    stripHiddenDynamicData: vi.fn(
      (data: Record<string, unknown>) => data,
    ),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));

const columnFixture = {
  id: "col-code",
  priceListId: PRICE_LIST_ID,
  originalName: "Codigo",
  displayName: "Código",
  internalKey: "codigo",
  dataType: "TEXT" as const,
  order: 0,
  visibleToNormalUser: true,
  isSearchable: true,
  isFilterable: false,
  isAdminEditable: true,
  isReadOnly: false,
  isPrimaryCode: true,
  isDescription: false,
  isPrice: false,
  isRequired: false,
  width: null,
  format: null,
  unit: null,
  label: null,
  helpText: null,
  helpImageAltText: null,
  helpImagePath: null,
  helpImageThumbnailPath: null,
  helpImageMimeType: null,
  helpImageSizeBytes: null,
  helpImageOriginalName: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const itemFixture = {
  id: "item-1",
  priceListId: PRICE_LIST_ID,
  primaryCode: "ABC-1",
  normalizedCode: "ABC1",
  description: "Repuesto",
  amount: new Prisma.Decimal("100.5"),
  dynamicData: {},
  originalText: null,
  indexedText: "ABC-1 Repuesto 100.5",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PriceItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(priceListService.requirePriceListForAdmin).mockResolvedValue(undefined);
    vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([
      columnFixture,
    ]);
  });

  it("updateItem persiste cambios y audita", async () => {
    vi.mocked(priceItemRepository.findById).mockResolvedValue(itemFixture);
    vi.mocked(priceItemRepository.update).mockResolvedValue({
      ...itemFixture,
      primaryCode: "ABC-2",
    });

    const result = await priceItemService.updateItem("item-1", {
      codigo: "ABC-2",
    });

    expect(result.primaryCode).toBe("ABC-2");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.PRICE_ITEM_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_ITEM,
      entityId: "item-1",
    });
  });

  it("deleteItem elimina y audita", async () => {
    vi.mocked(priceItemRepository.findById).mockResolvedValue(itemFixture);

    await priceItemService.deleteItem("item-1");

    expect(priceItemRepository.delete).toHaveBeenCalledWith("item-1");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.PRICE_ITEM_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_ITEM,
      entityId: "item-1",
    });
  });
});
