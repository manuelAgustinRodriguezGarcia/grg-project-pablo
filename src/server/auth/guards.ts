import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";
import { userRepository } from "@/server/repositories/user.repository";
import { AUTH_LOGIN_PATH } from "./config";
import { AuthError, AuthForbiddenError } from "./errors";
import { createSupabaseServerClient } from "./supabase-server";
import { resolveSupabaseAuthUser } from "./supabase-user";
import type { AuthenticatedUser } from "./types";

function resolveDisplayName(
  metadata: Record<string, unknown> | undefined,
  email: string,
): string {
  const name = metadata?.name ?? metadata?.full_name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }

  return email.split("@")[0] ?? email;
}

async function loadAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerClient();
  const user = await resolveSupabaseAuthUser(supabase);

  if (!user) {
    throw new AuthError("Debes iniciar sesión para continuar.", "UNAUTHENTICATED");
  }

  let profile = await userRepository.findById(user.id);

  if (!profile) {
    profile = await userRepository.upsertFromAuth({
      id: user.id,
      email: user.email ?? "",
      name: resolveDisplayName(user.user_metadata, user.email ?? "Usuario"),
      role: "USUARIO",
    });
  }

  if (profile.status === "INACTIVE") {
    await supabase.auth.signOut();
    throw new AuthError(
      "Tu cuenta está desactivada. Contacta al administrador.",
      "USER_INACTIVE",
    );
  }

  await userRepository.touchLastAccessIfStale(
    user.id,
    10 * 60 * 1000,
    profile.lastAccessAt,
  );

  return { supabaseUser: user, profile };
}

/** Exige sesión válida y perfil local activo. Lanza `AuthError` si falla. */
export async function requireAuth(): Promise<AuthenticatedUser> {
  return loadAuthenticatedUser();
}

/** Exige un rol concreto además de sesión válida. */
export async function requireRole(role: UserRole): Promise<AuthenticatedUser> {
  const auth = await requireAuth();

  if (auth.profile.role !== role) {
    throw new AuthForbiddenError();
  }

  return auth;
}

/** Redirige al login si no hay sesión válida (para layouts/páginas). */
export async function requireAuthOrRedirect(
  redirectTo?: string,
): Promise<AuthenticatedUser> {
  try {
    return await requireAuth();
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      const params = new URLSearchParams();
      if (redirectTo) {
        params.set("redirectTo", redirectTo);
      }
      const query = params.toString();
      redirect(query ? `${AUTH_LOGIN_PATH}?${query}` : AUTH_LOGIN_PATH);
    }

    throw error;
  }
}

export async function requireRoleOrRedirect(
  role: UserRole,
  redirectTo?: string,
): Promise<AuthenticatedUser> {
  const auth = await requireAuthOrRedirect(redirectTo);

  if (auth.profile.role !== role) {
    throw new AuthForbiddenError();
  }

  return auth;
}
