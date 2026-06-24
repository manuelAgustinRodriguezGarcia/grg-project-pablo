import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { EquivalenceError } from "@/server/services/equivalence.errors";
import { equivalenceService } from "@/server/services/equivalence.service";

type RouteContext = {
  params: Promise<{ productId: string; equivalenceId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { productId, equivalenceId } = await context.params;
    await equivalenceService.remove(equivalenceId, productId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof EquivalenceError) {
        const status =
          domainError.code === "EQUIVALENCE_NOT_FOUND" ||
          domainError.code === "PRODUCT_NOT_FOUND"
            ? 404
            : 400;

        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
