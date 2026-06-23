import { type NextRequest, NextResponse } from "next/server";
import {
  ADMIN_HOME_PATH,
  AUTH_LOGIN_PATH,
  AUTH_PUBLIC_PATHS,
  PROTECTED_PATH_PREFIXES,
} from "@/server/auth/config";
import { updateSession } from "@/server/auth/supabase-middleware";

function isPublicAuthPath(pathname: string): boolean {
  return AUTH_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function buildLoginRedirect(request: NextRequest): URL {
  const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (redirectTo && redirectTo !== AUTH_LOGIN_PATH) {
    loginUrl.searchParams.set("redirectTo", redirectTo);
  }

  return loginUrl;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublicAuthPath(pathname)) {
    if (user && pathname === AUTH_LOGIN_PATH) {
      const redirectTo =
        request.nextUrl.searchParams.get("redirectTo") ?? ADMIN_HOME_PATH;
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    return response;
  }

  if (isProtectedPath(pathname) && !user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    return NextResponse.redirect(buildLoginRedirect(request));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
