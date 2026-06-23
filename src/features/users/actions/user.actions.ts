"use server";

import { AuthError } from "@/server/auth";
import { userService } from "@/server/services/user.service";
import { UserError } from "@/server/services/user.errors";
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
} from "@/features/users/schemas/user.schemas";
import type { UserActionResult, UserListItem } from "@/features/users/types/user.types";
import { toUserListItem } from "@/features/users/types/user.types";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";

function toActionError(error: unknown): UserActionResult<never> {
  if (error instanceof UserError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listUsersAction(): Promise<UserActionResult<UserListItem[]>> {
  try {
    const users = await userService.listUsers();
    return { success: true, data: users.map(toUserListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createUserAction(
  input: unknown,
): Promise<UserActionResult<UserListItem>> {
  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const user = await userService.createUser(parsed.data);
    return { success: true, data: toUserListItem(user) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateUserAction(
  input: unknown,
): Promise<UserActionResult<UserListItem>> {
  const parsed = updateUserSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const user = await userService.updateUser(parsed.data);
    return { success: true, data: toUserListItem(user) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateUserAction(
  input: unknown,
): Promise<UserActionResult<UserListItem>> {
  const parsed = userIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const user = await userService.deactivateUser(parsed.data.userId);
    return { success: true, data: toUserListItem(user) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function activateUserAction(
  input: unknown,
): Promise<UserActionResult<UserListItem>> {
  const parsed = userIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const user = await userService.activateUser(parsed.data.userId);
    return { success: true, data: toUserListItem(user) };
  } catch (error) {
    return toActionError(error);
  }
}
