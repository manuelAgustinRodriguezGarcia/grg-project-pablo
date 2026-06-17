import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { StorageError } from "./errors";

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

function getSupabaseEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new StorageError(
      "NEXT_PUBLIC_SUPABASE_URL no está definida en las variables de entorno.",
    );
  }

  if (!serviceRoleKey) {
    throw new StorageError(
      "SUPABASE_SERVICE_ROLE_KEY no está definida en las variables de entorno.",
    );
  }

  return { url, serviceRoleKey };
}

function createSupabaseAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Cliente Supabase con service role — solo uso en servidor. */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalForSupabase.supabaseAdmin) {
    globalForSupabase.supabaseAdmin = createSupabaseAdminClient();
  }

  return globalForSupabase.supabaseAdmin;
}
