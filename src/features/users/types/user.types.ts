import type { User } from "@/generated/prisma/client";

export type UserActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type UserListItem = Pick<
  User,
  "id" | "name" | "email" | "role" | "status" | "lastAccessAt" | "createdAt"
>;

export function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastAccessAt: user.lastAccessAt,
    createdAt: user.createdAt,
  };
}
