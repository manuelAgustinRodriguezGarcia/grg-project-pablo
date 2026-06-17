import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User, UserRole } from "@/generated/prisma/client";
import type { OFFLINE_DATA_CLEAR_SIGNAL } from "./config";

export type AuthenticatedUser = {
  supabaseUser: SupabaseUser;
  profile: User;
};

export type AuthActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type SignOutResult = {
  clearOfflineData: true;
  signal: typeof OFFLINE_DATA_CLEAR_SIGNAL;
};

export type { UserRole };
