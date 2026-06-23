import { NextResponse } from "next/server";
import {
  ADMIN_HOME_PATH,
  AUTH_RESET_PASSWORD_PATH,
  createSupabaseServerClient,
} from "@/server/auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? ADMIN_HOME_PATH;

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/auth/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  const destination =
    next === AUTH_RESET_PASSWORD_PATH
      ? AUTH_RESET_PASSWORD_PATH
      : next.startsWith("/")
        ? next
        : ADMIN_HOME_PATH;

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
