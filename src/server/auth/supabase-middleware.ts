import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

export type MiddlewareSessionResult = {
  supabase: SupabaseClient;
  response: NextResponse;
  user: Awaited<
    ReturnType<SupabaseClient["auth"]["getUser"]>
  >["data"]["user"];
};

/**
 * Refresca la sesión de Supabase y devuelve el cliente + respuesta con cookies actualizadas.
 * Debe invocarse en middleware antes de evaluar rutas protegidas.
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}
