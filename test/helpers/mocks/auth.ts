import type { User } from "@/generated/prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { vi } from "vitest";
import {
  requireAdmin,
  requireAuth,
  requireEditor,
  requireRole,
} from "@/server/auth";
import { AuthError, AuthForbiddenError } from "@/server/auth/errors";
import type { AuthenticatedUser } from "@/server/auth/types";
import {
  adminUserFixture,
  usuarioUserFixture,
} from "../fixtures/user.fixture";

export { adminUserFixture, usuarioUserFixture };

function createSupabaseUser(profile: User): SupabaseUser {
  return {
    id: profile.id,
    email: profile.email,
    app_metadata: {},
    user_metadata: { name: profile.name, role: profile.role },
    aud: "authenticated",
    created_at: profile.createdAt.toISOString(),
  } as SupabaseUser;
}

export function createAuthenticatedUser(profile: User): AuthenticatedUser {
  return {
    profile,
    supabaseUser: createSupabaseUser(profile),
  };
}

export function mockRequireAuth(profile: User = adminUserFixture): void {
  vi.mocked(requireAuth).mockResolvedValue(createAuthenticatedUser(profile));
}

export function mockRequireRole(profile: User = adminUserFixture): void {
  const auth = createAuthenticatedUser(profile);
  vi.mocked(requireRole).mockResolvedValue(auth);
  vi.mocked(requireAdmin).mockResolvedValue(auth);
  vi.mocked(requireEditor).mockResolvedValue(auth);
}

export function mockRequireAdmin(profile: User = adminUserFixture): void {
  vi.mocked(requireAdmin).mockResolvedValue(createAuthenticatedUser(profile));
}

export function mockRequireEditor(profile: User = adminUserFixture): void {
  vi.mocked(requireEditor).mockResolvedValue(createAuthenticatedUser(profile));
}

export function mockRequireRoleForbidden(): void {
  const error = new AuthForbiddenError();
  vi.mocked(requireRole).mockRejectedValue(error);
  vi.mocked(requireAdmin).mockRejectedValue(error);
  vi.mocked(requireEditor).mockRejectedValue(error);
}

export function mockRequireAdminForbidden(): void {
  vi.mocked(requireAdmin).mockRejectedValue(new AuthForbiddenError());
}

export function mockRequireEditorForbidden(): void {
  vi.mocked(requireEditor).mockRejectedValue(new AuthForbiddenError());
}

export function mockRequireAuthUnauthenticated(): void {
  vi.mocked(requireAuth).mockRejectedValue(
    new AuthError("Debes iniciar sesión para continuar.", "UNAUTHENTICATED"),
  );
}
