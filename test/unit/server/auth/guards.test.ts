import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth } from "@/server/auth/guards";
import { userRepository } from "@/server/repositories/user.repository";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

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

describe("guards auto-provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asigna USUARIO al auto-provisionar aunque metadata diga ADMIN", async () => {
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
      role: input.role,
      status: "ACTIVE",
      lastAccessAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    vi.mocked(userRepository.touchLastAccessIfStale).mockResolvedValue(undefined);

    const auth = await requireAuth();

    expect(userRepository.upsertFromAuth).toHaveBeenCalledWith(
      expect.objectContaining({ role: "USUARIO" }),
    );
    expect(auth.profile.role).toBe("USUARIO");
  });
});
