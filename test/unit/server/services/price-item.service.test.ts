import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { priceItemService } from "@/server/services/price-item.service";
import { priceListService } from "@/server/services/price-list.service";
import {
  adminUserFixture,
  mockRequireAuth,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { PRICE_LIST_ID } from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));
vi.mock("@/server/repositories/price-item.repository", () => ({
  priceItemRepository: {
    findByPriceListPaginated: vi.fn(),
    findByPriceListPaginatedWithScopedSearch: vi.fn(),
    findIdsMatchingScopedSearch: vi.fn(),
    searchAcrossPriceLists: vi.fn(),
    countItemsBefore: vi.fn(),
    findPaginated: vi.fn(),
    findIdsMatchingJsonTextFilters: vi.fn(),
    findIdsMatchingAmountContainsFilters: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
    findByPriceListIdsOrdered: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-list.repository", () => ({
  priceListRepository: {
    findAllOrdered: vi.fn(),
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
    priceListWhereForRole: vi.fn(() => ({})),
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
  normalizedIndexedText: "ABC1REPUESTO1005",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PriceItemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(adminUserFixture);
    mockRequireRole(adminUserFixture);
    vi.mocked(priceListService.requirePriceListForAdmin).mockResolvedValue(undefined);
    vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([
      columnFixture,
    ]);
  });

  it("listItems busca las columnas de texto de la lista y no el precio", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: PRICE_LIST_ID,
      name: "Nueva",
    } as never);
    vi.mocked(priceColumnRepository.findByPriceListIdOrdered).mockResolvedValue([
      { ...columnFixture, order: 2 },
      {
        ...columnFixture,
        id: "col-equiv",
        internalKey: "equivalencias",
        originalName: "Equivalencias",
        displayName: "Equivalencias",
        order: 0,
        isPrimaryCode: false,
      },
      {
        ...columnFixture,
        id: "col-otros",
        internalKey: "otros_datos",
        originalName: "Otros datos",
        displayName: "Otros datos",
        order: 1,
        isPrimaryCode: false,
      },
      {
        ...columnFixture,
        id: "col-precio",
        internalKey: "precio",
        originalName: "Precio",
        displayName: "Precio",
        order: 3,
        isPrimaryCode: false,
        isPrice: true,
      },
    ]);
    vi.mocked(priceItemRepository.findByPriceListPaginatedWithScopedSearch).mockResolvedValue({
      items: [itemFixture],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await priceItemService.listItems({
      priceListId: PRICE_LIST_ID,
      query: "6205",
    });

    expect(priceItemRepository.findByPriceListPaginatedWithScopedSearch).toHaveBeenCalledWith(
      PRICE_LIST_ID,
      { page: 1, pageSize: 50 },
      expect.objectContaining({ normalizedQuery: "6205", includeNormalizedText: false }),
      {
        includePrimaryCode: true,
        includeDescription: false,
        dynamicKeys: ["equivalencias", "otros_datos"],
      },
    );
    expect(priceItemRepository.findByPriceListPaginated).not.toHaveBeenCalled();
    expect(result.columns.map((column) => column.order)).toEqual([2, 0, 1, 3]);
    expect(result.items).toHaveLength(1);
  });

  it("searchAllLists busca en todas las listas visibles y agrupa por lista", async () => {
    vi.mocked(priceListRepository.findAllOrdered).mockResolvedValue([
      { id: "list-a", name: "Lista A" },
      { id: "list-b", name: "Lista B" },
    ] as never);
    vi.mocked(priceColumnRepository.findByPriceListIdsOrdered).mockResolvedValue([
      { ...columnFixture, priceListId: "list-a" },
      { ...columnFixture, id: "col-code-b", priceListId: "list-b" },
    ]);
    vi.mocked(priceItemRepository.searchAcrossPriceLists).mockResolvedValue([
      { ...itemFixture, id: "item-b", priceListId: "list-b", searchTotal: 3 },
    ]);

    const result = await priceItemService.searchAllLists("abc-1");

    expect(priceItemRepository.searchAcrossPriceLists).toHaveBeenCalledWith(
      [
        expect.objectContaining({ priceListId: "list-a" }),
        expect.objectContaining({ priceListId: "list-b" }),
      ],
      expect.objectContaining({ normalizedQuery: "ABC1" }),
      8,
    );
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.priceList).toEqual({ id: "list-b", name: "Lista B" });
    expect(result.groups[0]?.total).toBe(3);
    expect(result.groups[0]?.items.map((item) => item.id)).toEqual(["item-b"]);
  });

  it("searchAllLists no consulta con menos de dos caracteres", async () => {
    const result = await priceItemService.searchAllLists("a");

    expect(result.groups).toEqual([]);
    expect(priceItemRepository.searchAcrossPriceLists).not.toHaveBeenCalled();
  });

  it("locateItemPage calcula la página del ítem en la lista completa", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: PRICE_LIST_ID,
      name: "Nueva",
    } as never);
    vi.mocked(priceItemRepository.findById).mockResolvedValue(itemFixture);
    vi.mocked(priceItemRepository.countItemsBefore).mockResolvedValue(120);

    await expect(
      priceItemService.locateItemPage(PRICE_LIST_ID, itemFixture.id, 50),
    ).resolves.toEqual({ page: 3 });
  });

  it("locateItemPage rechaza ítems de otra lista", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: "otra-lista",
      name: "Otra",
    } as never);
    vi.mocked(priceItemRepository.findById).mockResolvedValue(itemFixture);

    await expect(
      priceItemService.locateItemPage("otra-lista", itemFixture.id, 50),
    ).rejects.toMatchObject({ code: "PRICE_ITEM_NOT_FOUND" });
  });

  it("listItems con itemId devuelve solo ese ítem", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: PRICE_LIST_ID,
      name: "Nueva",
    } as never);
    vi.mocked(priceItemRepository.findByPriceListPaginated).mockResolvedValue({
      items: [itemFixture],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    await priceItemService.listItems({
      priceListId: PRICE_LIST_ID,
      query: "ABC-1",
      itemId: itemFixture.id,
    });

    expect(priceItemRepository.findByPriceListPaginated).toHaveBeenCalledWith(
      PRICE_LIST_ID,
      { page: 1, pageSize: 50 },
      { id: itemFixture.id },
    );
    expect(priceItemRepository.findByPriceListPaginatedWithScopedSearch).not.toHaveBeenCalled();
  });

  it("ignora búsquedas de un solo carácter", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: PRICE_LIST_ID,
      name: "Nueva",
    } as never);
    vi.mocked(priceItemRepository.findByPriceListPaginated).mockResolvedValue({
      items: [itemFixture],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    await priceItemService.listItems({
      priceListId: PRICE_LIST_ID,
      query: "a",
    });

    expect(priceItemRepository.findByPriceListPaginatedWithScopedSearch).not.toHaveBeenCalled();
    expect(priceItemRepository.findByPriceListPaginated).toHaveBeenCalled();
  });

  it("listItems aplica filtros de columna acumulables", async () => {
    vi.mocked(priceListService.getPriceList).mockResolvedValue({
      id: PRICE_LIST_ID,
      name: "Nueva",
    } as never);
    vi.mocked(priceItemRepository.findPaginated).mockResolvedValue({
      items: [itemFixture],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await priceItemService.listItems({
      priceListId: PRICE_LIST_ID,
      filters: [
        {
          columnInternalKey: "codigo",
          operator: "contains",
          value: "ABC",
        },
      ],
    });

    expect(priceItemRepository.findPaginated).toHaveBeenCalled();
    expect(priceItemRepository.findByPriceListPaginatedWithScopedSearch).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
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
