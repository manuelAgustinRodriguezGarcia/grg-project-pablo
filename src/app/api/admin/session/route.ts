import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";

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
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
}
