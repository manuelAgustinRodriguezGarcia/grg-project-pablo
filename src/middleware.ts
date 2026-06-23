import { type NextRequest, NextResponse } from "next/server";
import {
  AUTH_LOGIN_PATH,
  AUTH_PUBLIC_PATHS,
  PROTECTED_PATH_PREFIXES,
} from "@/server/auth/config";
import { checkRateLimit, getRateLimitKey } from "@/server/auth/rate-limit";
import { resolveSafeRedirectPath } from "@/server/auth/safe-redirect";
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
      const redirectTo = resolveSafeRedirectPath(
        request.nextUrl.searchParams.get("redirectTo"),
      );
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    return response;
  }

  if (
    pathname.startsWith("/api/admin/imports") &&
    request.method === "POST"
  ) {
    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "upload"),
      20,
      60_000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Inténtalo más tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
  }

  if (pathname === AUTH_LOGIN_PATH && request.method === "POST") {
    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "login"),
      10,
      60_000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de inicio de sesión." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
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
