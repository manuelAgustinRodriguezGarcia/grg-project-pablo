import { AuthError } from "./errors";

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new AuthError(
      "NEXT_PUBLIC_SUPABASE_URL no está definida en las variables de entorno.",
      "AUTH_PROVIDER_ERROR",
    );
  }

  if (!anonKey) {
    throw new AuthError(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY no está definida en las variables de entorno.",
      "AUTH_PROVIDER_ERROR",
    );
  }

  return { url, anonKey };
}

export function getAppOrigin(): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    "http://localhost:3000";

  return origin.replace(/\/$/, "");
}
