import { NextResponse } from "next/server";
import { z } from "zod";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

const productOptionsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = productOptionsQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const products = await productService.listProductOptions(folderId, parsed.data.q);

    return NextResponse.json({ products });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        const status = domainError.code === "VALIDATION_ERROR" ? 400 : 404;
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
