import type { User, UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth";
import { userRepository } from "@/server/repositories/user.repository";
import { getSupabaseAdminClient } from "@/server/storage/supabase-admin";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { UserError } from "./user.errors";

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

export type UpdateUserInput = {
  id: string;
  name?: string;
  role?: UserRole;
};

function mapAuthProviderError(message: string): UserError {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("duplicate")
  ) {
    return new UserError(
      "Ya existe un usuario con ese correo.",
      "EMAIL_ALREADY_EXISTS",
    );
  }

  return new UserError(message, "AUTH_PROVIDER_ERROR");
}

export class UserService {
  async listUsers(): Promise<User[]> {
    await requireRole("ADMIN");
    return userRepository.findAll();
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const { profile: admin } = await requireRole("ADMIN");

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new UserError(
        "Ya existe un usuario con ese correo.",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name,
        role: input.role,
      },
    });

    if (error) {
      throw mapAuthProviderError(error.message);
    }

    const authUser = data.user;
    if (!authUser) {
      throw new UserError(
        "No se pudo crear el usuario en el proveedor de autenticación.",
        "AUTH_PROVIDER_ERROR",
      );
    }

    const user = await userRepository.upsertFromAuth({
      id: authUser.id,
      email: input.email,
      name: input.name,
      role: input.role,
      status: "ACTIVE",
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
    });

    return user;
  }

  async updateUser(input: UpdateUserInput): Promise<User> {
    const { profile: admin } = await requireRole("ADMIN");

    const target = await userRepository.findById(input.id);
    if (!target) {
      throw new UserError("Usuario no encontrado.", "USER_NOT_FOUND");
    }

    const nextName = input.name ?? target.name;
    const nextRole = input.role ?? target.role;

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(input.id, {
      user_metadata: {
        name: nextName,
        role: nextRole,
      },
    });

    if (error) {
      throw mapAuthProviderError(error.message);
    }

    const user = await userRepository.updateProfile(input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
    });

    return user;
  }

  async deactivateUser(userId: string): Promise<User> {
    const { profile: admin } = await requireRole("ADMIN");

    if (admin.id === userId) {
      throw new UserError(
        "No puedes desactivar tu propia cuenta.",
        "CANNOT_DEACTIVATE_SELF",
      );
    }

    const target = await userRepository.findById(userId);
    if (!target) {
      throw new UserError("Usuario no encontrado.", "USER_NOT_FOUND");
    }

    if (target.status === "INACTIVE") {
      return target;
    }

    const profile = await userRepository.setStatus(userId, "INACTIVE");

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.signOut(userId, "global");

    if (error) {
      throw mapAuthProviderError(error.message);
    }

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_DEACTIVATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: profile.id,
    });

    return profile;
  }

  async activateUser(userId: string): Promise<User> {
    const { profile: admin } = await requireRole("ADMIN");

    const target = await userRepository.findById(userId);
    if (!target) {
      throw new UserError("Usuario no encontrado.", "USER_NOT_FOUND");
    }

    if (target.status === "ACTIVE") {
      return target;
    }

    const user = await userRepository.setStatus(userId, "ACTIVE");

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_ACTIVATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
    });

    return user;
  }
}

export const userService = new UserService();
