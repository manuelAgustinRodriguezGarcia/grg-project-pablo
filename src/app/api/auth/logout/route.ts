import { NextRequest, NextResponse } from "next/server";
import { AUTH_LOGIN_PATH } from "@/server/auth/config";
import { authService } from "@/server/auth/auth.service";

export async function POST(request: NextRequest) {
  try {
    await authService.signOut();
    return NextResponse.redirect(new URL(AUTH_LOGIN_PATH, request.url), 303);
  } catch {
    return NextResponse.redirect(
      new URL(`${AUTH_LOGIN_PATH}?error=logout_failed`, request.url),
      303,
    );
  }
}
