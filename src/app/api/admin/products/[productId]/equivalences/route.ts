import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { EquivalenceError } from "@/server/services/equivalence.errors";
import { equivalenceService } from "@/server/services/equivalence.service";
import { addEquivalenceBodySchema } from "@/features/records/schemas/product.schemas";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

function mapEquivalenceError(error: EquivalenceError): NextResponse {
  const status =
    error.code === "EQUIVALENCE_NOT_FOUND" || error.code === "PRODUCT_NOT_FOUND"
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const equivalences = await equivalenceService.listByProduct(productId);
    return NextResponse.json({ productId, equivalences });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof EquivalenceError) {
        return mapEquivalenceError(domainError);
      }

      return null;
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const body: unknown = await request.json();
    const parsed = addEquivalenceBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const equivalence = await equivalenceService.addManual(
      productId,
      parsed.data.originalCode,
    );

    return NextResponse.json(equivalence, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof EquivalenceError) {
        return mapEquivalenceError(domainError);
      }

      return null;
    });
  }
}
