import { NextResponse } from "next/server";
import { probeProductionWsfeDummy } from "@/server/arca/wsfe/wsfe-client";
import { AuthError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdmin();
    const result = await probeProductionWsfeDummy();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (error instanceof AuthError && error.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo consultar WSFEv1." },
      { status: 500 },
    );
  }
}
