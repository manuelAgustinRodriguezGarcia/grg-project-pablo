import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase-server";
import type { AuthenticatedUser } from "./types";

export async function getSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getSessionContext(): Promise<{
  supabaseUser: SupabaseUser | null;
}> {
  const supabaseUser = await getSupabaseUser();
  return { supabaseUser };
}

export function isAuthenticatedContext(
  context: Awaited<ReturnType<typeof getSessionContext>>,
): context is { supabaseUser: SupabaseUser } {
  return context.supabaseUser !== null;
}

export type { AuthenticatedUser };
