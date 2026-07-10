import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireAdmin,
  requireAdminOrRedirect,
  requireAuth,
  requireEditor,
} from "@/server/auth/guards";
import { userRepository } from "@/server/repositories/user.repository";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { AuthForbiddenError } from "@/server/auth/errors";
import {
  adminUserFixture,
  usuarioUserFixture,
  visualizacionUserFixture,
} from "../../../helpers/fixtures/user.fixture";

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/server/repositories/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
    upsertFromAuth: vi.fn(),
    touchLastAccess: vi.fn(),
    touchLastAccessIfStale: vi.fn(),
  },
}));

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

describe("guards auto-provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asigna VISUALIZACION al auto-provisionar aunque metadata diga ADMIN", async () => {
    const supabaseUser = {
      id: "new-user-id",
      email: "attacker@example.com",
      user_metadata: { role: "ADMIN", name: "Attacker" },
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: supabaseUser }, error: null }),
        signOut: vi.fn(),
      },
    } as never);

    vi.mocked(userRepository.findById).mockResolvedValue(null);
    vi.mocked(userRepository.upsertFromAuth).mockImplementation(async (input) => ({
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role ?? "VISUALIZACION",
      status: "ACTIVE",
      lastAccessAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

    const auth = await requireAuth();

    expect(userRepository.upsertFromAuth).toHaveBeenCalledWith(
      expect.objectContaining({ role: "VISUALIZACION" }),
    );
    expect(auth.profile.role).toBe("VISUALIZACION");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite ADMIN", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(adminUserFixture);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: adminUserFixture.id, email: adminUserFixture.email } },
          error: null,
        }),
        signOut: vi.fn(),
      },
    } as never);
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

    const auth = await requireAdmin();
    expect(auth.profile.role).toBe("ADMIN");
  });

  it("rechaza USUARIO y VISUALIZACION", async () => {
    for (const profile of [usuarioUserFixture, visualizacionUserFixture]) {
      vi.mocked(userRepository.findById).mockResolvedValue(profile);
      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: profile.id, email: profile.email } },
            error: null,
          }),
          signOut: vi.fn(),
        },
      } as never);
      vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

      await expect(requireAdmin()).rejects.toBeInstanceOf(AuthForbiddenError);
    }
  });
});

describe("requireEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite ADMIN y USUARIO", async () => {
    for (const profile of [adminUserFixture, usuarioUserFixture]) {
      vi.mocked(userRepository.findById).mockResolvedValue(profile);
      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: profile.id, email: profile.email } },
            error: null,
          }),
          signOut: vi.fn(),
        },
      } as never);
      vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

      const auth = await requireEditor();
      expect(auth.profile.role).toBe(profile.role);
    }
  });

  it("rechaza VISUALIZACION", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(visualizacionUserFixture);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: visualizacionUserFixture.id,
              email: visualizacionUserFixture.email,
            },
          },
          error: null,
        }),
        signOut: vi.fn(),
      },
    } as never);
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

    await expect(requireEditor()).rejects.toBeInstanceOf(AuthForbiddenError);
  });
});

describe("requireAdminOrRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite ADMIN sin redirigir", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(adminUserFixture);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: adminUserFixture.id, email: adminUserFixture.email } },
          error: null,
        }),
        signOut: vi.fn(),
      },
    } as never);
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

    const auth = await requireAdminOrRedirect("/admin");
    expect(auth.profile.role).toBe("ADMIN");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirige a catálogos si el rol no es ADMIN", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(usuarioUserFixture);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: usuarioUserFixture.id, email: usuarioUserFixture.email } },
          error: null,
        }),
        signOut: vi.fn(),
      },
    } as never);
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireAdminOrRedirect("/admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/admin/catalogos");
  });
});
