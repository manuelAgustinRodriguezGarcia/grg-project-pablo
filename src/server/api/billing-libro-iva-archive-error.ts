import { NextResponse } from "next/server";
import { BillingLibroIvaArchiveError } from "@/server/services/billing-libro-iva-archive.errors";

export function mapBillingLibroIvaArchiveError(
  error: unknown,
): NextResponse | null {
  if (!(error instanceof BillingLibroIvaArchiveError)) {
    return null;
  }

  const status = error.code === "VALIDATION_ERROR" ? 400 : 404;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}
