import type { UserRole } from "@/generated/prisma/client";
import { userRepository } from "@/server/repositories/user.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import {
  AUTH_CALLBACK_PATH,
  AUTH_RESET_PASSWORD_PATH,
  OFFLINE_DATA_CLEAR_SIGNAL,
} from "./config";
import { AuthError } from "./errors";
import { getAppOrigin } from "./env";
import { createSupabaseServerClient } from "./supabase-server";
import type { SignOutResult } from "./types";

export type SignInInput = {
  email: string;
  password: string;
};

export type RequestPasswordResetInput = {
  email: string;
};

export type UpdatePasswordInput = {
  password: string;
};

function mapSignInError(message: string): AuthError {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return new AuthError(
      "Correo o contraseña incorrectos.",
      "INVALID_CREDENTIALS",
    );
  }

  return new AuthError(message, "AUTH_PROVIDER_ERROR");
}

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

function resolveRole(metadata: Record<string, unknown> | undefined): UserRole {
  const role = metadata?.role;
  if (role === "ADMIN" || role === "CONSULTA") {
    return role;
  }

  return "CONSULTA";
}

export class AuthService {
  async signInWithPassword(input: SignInInput) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw mapSignInError(error.message);
    }

    const authUser = data.user;
    if (!authUser) {
      throw new AuthError(
        "No se pudo completar el inicio de sesión.",
        "AUTH_PROVIDER_ERROR",
      );
    }

    const existing = await userRepository.findById(authUser.id);

    if (existing?.status === "INACTIVE") {
      await supabase.auth.signOut();
      throw new AuthError(
        "Tu cuenta está desactivada. Contacta al administrador.",
        "USER_INACTIVE",
      );
    }

    const profile = await userRepository.upsertFromAuth({
      id: authUser.id,
      email: authUser.email ?? input.email,
      name: resolveDisplayName(
        authUser.user_metadata,
        authUser.email ?? input.email,
      ),
      role: existing?.role ?? resolveRole(authUser.user_metadata),
      status: existing?.status ?? "ACTIVE",
    });

    await userRepository.touchLastAccess(authUser.id);

    auditService.logOperationSafe({
      userId: profile.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: profile.id,
    });

    return { supabaseUser: authUser, profile };
  }

  async signOut(): Promise<SignOutResult> {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new AuthError(error.message, "AUTH_PROVIDER_ERROR");
    }

    if (user) {
      auditService.logOperationSafe({
        userId: user.id,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: user.id,
      });
    }

    return {
      clearOfflineData: true,
      signal: OFFLINE_DATA_CLEAR_SIGNAL,
    };
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    const supabase = await createSupabaseServerClient();
    const origin = getAppOrigin();
    const redirectTo = `${origin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(AUTH_RESET_PASSWORD_PATH)}`;

    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo,
    });

    if (error) {
      throw new AuthError(error.message, "AUTH_PROVIDER_ERROR");
    }
  }

  async updatePassword(input: UpdatePasswordInput): Promise<void> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password: input.password,
    });

    if (error) {
      throw new AuthError(error.message, "AUTH_PROVIDER_ERROR");
    }
  }
}

export const authService = new AuthService();
