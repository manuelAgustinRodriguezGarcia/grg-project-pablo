import { beforeEach, describe, expect, it, vi } from "vitest";
import { userRepository } from "@/server/repositories/user.repository";
import { getSupabaseAdminClient } from "@/server/storage/supabase-admin";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { userService } from "@/server/services/user.service";
import {
  adminUserFixture,
  mockRequireAdmin,
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
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
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
    mockRequireAdmin(adminUserFixture);
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
      expect(supabase.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nuevo@example.com",
          email_confirm: true,
        }),
      );
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

    it("impide que el admin degrade su propio rol", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(adminUserFixture);

      await expect(
        userService.updateUser({ id: ADMIN_USER_ID, role: "USUARIO" }),
      ).rejects.toMatchObject({ code: "CANNOT_CHANGE_OWN_ROLE" });
    });

    it("actualiza email y contraseña en Supabase y perfil local", async () => {
      const target = createUserFixture({
        id: TARGET_USER_ID,
        email: "viejo@example.com",
      });
      vi.mocked(userRepository.findById).mockResolvedValue(target);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      const supabase = setupSupabaseAdminMock();

      await userService.updateUser({
        id: TARGET_USER_ID,
        email: "nuevo@example.com",
        password: "nuevaclave123",
        name: "Nombre nuevo",
      });

      expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        TARGET_USER_ID,
        expect.objectContaining({
          email: "nuevo@example.com",
          email_confirm: true,
          password: "nuevaclave123",
        }),
      );
      expect(userRepository.updateProfile).toHaveBeenCalledWith(TARGET_USER_ID, {
        name: "Nombre nuevo",
        email: "nuevo@example.com",
      });
      expect(supabase.auth.admin.signOut).toHaveBeenCalledWith(
        TARGET_USER_ID,
        "global",
      );
    });

    it("rechaza email duplicado de otro usuario", async () => {
      const target = createUserFixture({ id: TARGET_USER_ID });
      vi.mocked(userRepository.findById).mockResolvedValue(target);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(
        createUserFixture({ id: "otro-id", email: "ocupado@example.com" }),
      );

      await expect(
        userService.updateUser({
          id: TARGET_USER_ID,
          email: "ocupado@example.com",
        }),
      ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
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
