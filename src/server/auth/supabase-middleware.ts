import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";
import { resolveSupabaseAuthUser } from "./supabase-user";

export type MiddlewareSessionResult = {
  supabase: SupabaseClient;
  response: NextResponse;
  user: User | null;
};

/**
 * Refresca la sesión de Supabase y devuelve el cliente + respuesta con cookies actualizadas.
 * Debe invocarse en proxy antes de evaluar rutas protegidas.
 */
export async function updateSession(
  request: NextRequest,
): Promise<MiddlewareSessionResult> {
  const { url, anonKey } = getSupabasePublicEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
      },
    },
  });

  const user = await resolveSupabaseAuthUser(supabase);

  return { supabase, response, user };
}
