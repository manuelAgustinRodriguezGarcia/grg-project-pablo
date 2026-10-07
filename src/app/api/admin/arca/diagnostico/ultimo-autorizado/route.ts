import { NextResponse } from "next/server";
import { probeProductionLastAuthorizedFacturaA } from "@/server/arca/diagnostico/ultimo-autorizado";
import { AuthError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diagnosticStatus(code: string): number {
  switch (code) {
    case "FISCAL_CONFIGURATION_MISMATCH":
    case "CUIT_INVALIDO":
    case "PUNTO_DE_VENTA_INVALIDO":
      return 409;
    default:
      return 502;
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const result = await probeProductionLastAuthorizedFacturaA();
    return NextResponse.json(result, {
      status: result.ok ? 200 : diagnosticStatus(result.code),
    });
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
      { error: "No se pudo consultar el último comprobante autorizado." },
      { status: 500 },
    );
  }
}
