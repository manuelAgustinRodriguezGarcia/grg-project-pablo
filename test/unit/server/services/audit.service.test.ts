import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditRepository } from "@/server/repositories/audit.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { AuditService } from "@/server/services/audit.service";
import { ADMIN_USER_ID } from "../../../helpers/fixtures/user.fixture";

vi.mock("@/server/repositories/audit.repository", () => ({
  auditRepository: {
    create: vi.fn(),
  },
}));

describe("AuditService", () => {
  let auditService: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditService();
  });

  it("persiste operaciones cuando el repositorio responde OK", async () => {
    vi.mocked(auditRepository.create).mockResolvedValue(undefined);

    await auditService.logOperation({
      userId: ADMIN_USER_ID,
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: ADMIN_USER_ID,
    });

    expect(auditRepository.create).toHaveBeenCalledWith({
      userId: ADMIN_USER_ID,
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: ADMIN_USER_ID,
    });
  });

  it("no lanza si el repositorio falla", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(auditRepository.create).mockRejectedValue(new Error("db down"));

    await expect(
      auditService.logOperation({
        userId: ADMIN_USER_ID,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: ADMIN_USER_ID,
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("logOperationSafe no bloquea al llamador", () => {
    vi.mocked(auditRepository.create).mockResolvedValue(undefined);

    expect(() =>
      auditService.logOperationSafe({
        userId: ADMIN_USER_ID,
        action: AUDIT_ACTIONS.CATALOG_CREATED,
        entityType: AUDIT_ENTITY_TYPES.CATALOG,
        entityId: "clh3pb1a3000012345678901ab",
      }),
    ).not.toThrow();
  });
});
