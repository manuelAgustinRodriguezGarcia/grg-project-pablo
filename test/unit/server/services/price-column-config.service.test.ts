import { beforeEach, describe, expect, it, vi } from "vitest";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { priceColumnConfigService } from "@/server/services/price-column-config.service";
import { PriceColumnConfigError } from "@/server/services/price-column-config.errors";
import {
  adminUserFixture,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import {
  createPriceListFixture,
  PRICE_LIST_ID,
} from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    getNextOrder: vi.fn(),
    countPrimaryCodeByPriceList: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-list.repository", () => ({
  priceListRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));

const columnFixture = {
  id: "col-1",
  priceListId: PRICE_LIST_ID,
  originalName: "Precio",
  displayName: "Precio",
  internalKey: "precio",
  dataType: "NUMBER" as const,
  order: 1,
  visibleToNormalUser: true,
  isSearchable: false,
  isFilterable: false,
  isAdminEditable: true,
  isReadOnly: false,
  isPrimaryCode: false,
  isDescription: false,
  isPrice: true,
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

describe("PriceColumnConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(priceListRepository.findById).mockResolvedValue(createPriceListFixture());
    vi.mocked(priceColumnRepository.countPrimaryCodeByPriceList).mockResolvedValue(0);
    vi.mocked(priceColumnRepository.getNextOrder).mockResolvedValue(2);
    vi.mocked(priceColumnRepository.isUniqueConstraintError).mockReturnValue(false);
  });

  it("createColumn persiste y audita", async () => {
    vi.mocked(priceColumnRepository.create).mockResolvedValue(columnFixture);

    const result = await priceColumnConfigService.createColumn({
      priceListId: PRICE_LIST_ID,
      originalName: "Precio",
      displayName: "Precio",
      internalKey: "precio",
      isPrice: true,
    });

    expect(result.internalKey).toBe("precio");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.PRICE_COLUMN_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_COLUMN,
      entityId: columnFixture.id,
    });
  });

  it("deleteColumn elimina y audita", async () => {
    vi.mocked(priceColumnRepository.findById).mockResolvedValue(columnFixture);

    await priceColumnConfigService.deleteColumn("col-1");

    expect(priceColumnRepository.delete).toHaveBeenCalledWith("col-1");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.PRICE_COLUMN_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_COLUMN,
      entityId: "col-1",
    });
  });

  it("reorderColumns delega al repositorio", async () => {
    await priceColumnConfigService.reorderColumns({
      priceListId: PRICE_LIST_ID,
      items: [
        { id: "col-1", order: 0 },
        { id: "col-2", order: 1 },
      ],
    });

    expect(priceColumnRepository.reorder).toHaveBeenCalledWith([
      { id: "col-1", order: 0 },
      { id: "col-2", order: 1 },
    ]);
  });

  it("rechaza segunda columna de código principal", async () => {
    vi.mocked(priceColumnRepository.countPrimaryCodeByPriceList).mockResolvedValue(1);

    await expect(
      priceColumnConfigService.createColumn({
        priceListId: PRICE_LIST_ID,
        originalName: "Codigo 2",
        displayName: "Código 2",
        internalKey: "codigo_2",
        isPrimaryCode: true,
      }),
    ).rejects.toBeInstanceOf(PriceColumnConfigError);
  });
});
