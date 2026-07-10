import { beforeEach, describe, expect, it, vi } from "vitest";
import { userRepository } from "@/server/repositories/user.repository";
import { getSupabaseAdminClient } from "@/server/storage/supabase-admin";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { userService } from "@/server/services/user.service";
import {
  adminUserFixture,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { setupUserRepositoryMocks } from "../../../helpers/mocks/user.repository";
import {
  createSupabaseAdminMock,
  setupSupabaseAdminMock,
} from "../../../helpers/mocks/supabase-admin";
import {
  ADMIN_USER_ID,
  TARGET_USER_ID,
  createUserFixture,
} from "../../../helpers/fixtures/user.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/user.repository", () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    upsertFromAuth: vi.fn(),
    updateProfile: vi.fn(),
    setStatus: vi.fn(),
    touchLastAccess: vi.fn(),
  },
}));
vi.mock("@/server/storage/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    setupUserRepositoryMocks();
    setupSupabaseAdminMock();
  });

  describe("createUser", () => {
    it("rechaza correos duplicados", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(
        createUserFixture({ email: "nuevo@example.com" }),
      );

      await expect(
        userService.createUser({
          email: "nuevo@example.com",
          password: "password123",
          name: "Nuevo",
          role: "USUARIO",
        }),
      ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
    });

    it("crea usuario en Supabase y perfil local", async () => {
      const supabase = setupSupabaseAdminMock();

      const user = await userService.createUser({
        email: "nuevo@example.com",
        password: "password123",
        name: "Nuevo Usuario",
        role: "USUARIO",
      });

      expect(getSupabaseAdminClient).toHaveBeenCalled();
      expect(supabase.auth.admin.createUser).toHaveBeenCalled();
      expect(userRepository.upsertFromAuth).toHaveBeenCalled();
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: user.id,
      });
    });
  });

  describe("updateUser", () => {
    it("lanza error si el usuario no existe", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(
        userService.updateUser({ id: TARGET_USER_ID, name: "Nuevo nombre" }),
      ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });

  describe("deactivateUser", () => {
    it("impide auto-desactivación", async () => {
      await expect(userService.deactivateUser(ADMIN_USER_ID)).rejects.toMatchObject({
        code: "CANNOT_DEACTIVATE_SELF",
      });
    });

    it("retorna el perfil si ya está inactivo", async () => {
      const inactiveUser = createUserFixture({
        id: TARGET_USER_ID,
        status: "INACTIVE",
      });
      vi.mocked(userRepository.findById).mockResolvedValue(inactiveUser);

      const result = await userService.deactivateUser(TARGET_USER_ID);

      expect(result).toEqual(inactiveUser);
      expect(userRepository.setStatus).not.toHaveBeenCalled();
    });

    it("desactiva usuario activo y cierra sesiones globales", async () => {
      const activeUser = createUserFixture({
        id: TARGET_USER_ID,
        status: "ACTIVE",
      });
      vi.mocked(userRepository.findById).mockResolvedValue(activeUser);
      const supabase = createSupabaseAdminMock();
      vi.mocked(getSupabaseAdminClient).mockReturnValue(
        supabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
      );

      await userService.deactivateUser(TARGET_USER_ID);

      expect(userRepository.setStatus).toHaveBeenCalledWith(TARGET_USER_ID, "INACTIVE");
      expect(supabase.auth.admin.signOut).toHaveBeenCalledWith(TARGET_USER_ID, "global");
    });
  });

  describe("activateUser", () => {
    it("retorna el perfil si ya está activo", async () => {
      const activeUser = createUserFixture({
        id: TARGET_USER_ID,
        status: "ACTIVE",
      });
      vi.mocked(userRepository.findById).mockResolvedValue(activeUser);

      const result = await userService.activateUser(TARGET_USER_ID);

      expect(result).toEqual(activeUser);
      expect(userRepository.setStatus).not.toHaveBeenCalled();
    });
  });
});
