import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { priceListService } from "@/server/services/price-list.service";
import {
  adminUserFixture,
  usuarioUserFixture,
  mockRequireAuth,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";
import {
  createPriceListWithItemCountFixture,
  PRICE_LIST_ID,
} from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
}));
vi.mock("@/server/repositories/price-list.repository", () => ({
  priceListRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
    findByIdWithItemCount: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clearItems: vi.fn(),
    reorder: vi.fn(),
    getNextOrder: vi.fn(),
    countByName: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

describe("PriceListService", () => {
  const listFixture = createPriceListWithItemCountFixture();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    mockRequireAuth(usuarioUserFixture);
    vi.mocked(priceListRepository.findByIdWithItemCount).mockResolvedValue(listFixture);
    vi.mocked(priceListRepository.findAllOrdered).mockResolvedValue([listFixture]);
    vi.mocked(priceListRepository.countByName).mockResolvedValue(0);
    vi.mocked(priceListRepository.getNextOrder).mockResolvedValue(1);
    vi.mocked(priceListRepository.isUniqueConstraintError).mockReturnValue(false);
  });

  it("createPriceList persiste y audita", async () => {
    vi.mocked(priceListRepository.create).mockResolvedValue(listFixture);

    const result = await priceListService.createPriceList({
      name: "Lista general",
    });

    expect(result.name).toBe("Lista general");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.PRICE_LIST_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_LIST,
      entityId: listFixture.id,
    });
  });

  it("clearPriceList elimina ítems sin borrar la lista", async () => {
    vi.mocked(priceListRepository.clearItems).mockResolvedValue(5);

    const result = await priceListService.clearPriceList(PRICE_LIST_ID);

    expect(result.deletedCount).toBe(5);
    expect(priceListRepository.delete).not.toHaveBeenCalled();
    expect(auditService.logOperationSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.PRICE_LIST_CLEARED,
      }),
    );
  });

  it("USUARIO no ve listas ocultas en listado", async () => {
    const visible = createPriceListWithItemCountFixture({ visibleToNormalUser: true });
    vi.mocked(priceListRepository.findAllOrdered).mockResolvedValue([visible]);

    await priceListService.listPriceLists();

    expect(priceListRepository.findAllOrdered).toHaveBeenCalledWith({
      visibleToNormalUser: true,
      status: "ACTIVE",
    });
  });

  it("solo ADMIN puede crear listas", async () => {
    mockRequireRoleForbidden();

    await expect(
      priceListService.createPriceList({ name: "Nueva" }),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
  });
});
