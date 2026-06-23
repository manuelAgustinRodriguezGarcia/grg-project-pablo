import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/server/auth";

export async function GET() {
  try {
    const { profile } = await requireAuth();
    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      status: profile.status,
    });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
}
