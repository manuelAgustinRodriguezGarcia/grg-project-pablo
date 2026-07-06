import type { SupabaseClient, User } from "@supabase/supabase-js";

function isStaleRefreshTokenError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "refresh_token_not_found" ||
    error.code === "invalid_refresh_token" ||
    (error.message?.toLowerCase().includes("refresh token") ?? false)
  );
}

async function clearStaleSession(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // La sesión ya es inválida; ignorar errores al limpiar cookies locales.
  }
}

/**
 * Resuelve el usuario autenticado sin propagar errores de refresh token caducado.
 * Limpia cookies locales cuando el refresh token ya no existe en Supabase.
 */
export async function resolveSupabaseAuthUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isStaleRefreshTokenError(error)) {
        await clearStaleSession(supabase);
      }
      return null;
    }

    return user;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      isStaleRefreshTokenError(error as { code?: string; message?: string })
    ) {
      await clearStaleSession(supabase);
    }

    return null;
  }
}
