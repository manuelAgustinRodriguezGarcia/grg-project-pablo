"use server";

import { redirect } from "next/navigation";
import { ADMIN_HOME_PATH, AuthError } from "@/server/auth";
import { authService } from "@/server/auth/auth.service";
import type { AuthActionResult, SignOutResult } from "@/server/auth/types";
import {
  requestPasswordResetSchema,
  signInSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas/auth.schemas";

function toActionError(error: unknown): AuthActionResult<never> {
  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function signInAction(
  input: unknown,
  redirectTo = ADMIN_HOME_PATH,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    await authService.signInWithPassword(parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  redirect(redirectTo);
}

export async function signOutAction(): Promise<AuthActionResult<SignOutResult>> {
  try {
    const result = await authService.signOut();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<AuthActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    await authService.requestPasswordReset(parsed.data);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePasswordAction(
  input: unknown,
): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    await authService.updatePassword({ password: parsed.data.password });
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
