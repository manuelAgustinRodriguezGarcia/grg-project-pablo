import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";
import {
  createProductBodySchema,
} from "@/features/records/schemas/product.schemas";
import { folderProductListQuerySchema } from "@/features/catalog/schemas/search.schemas";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

function mapProductError(error: ProductError): NextResponse {
  const status =
    error.code === "VALIDATION_ERROR" || error.code === "COLUMN_NOT_EDITABLE"
      ? 400
      : 404;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = folderProductListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      filters: searchParams.get("filters") ?? undefined,
      includeFullUrls: searchParams.get("includeFullUrls") ?? undefined,
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

    const table = await productService.listProductsByFolder({
      folderId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      query: parsed.data.q,
      filters: parsed.data.filters,
      includeFullUrls: parsed.data.includeFullUrls,
    });

    return NextResponse.json(table);
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const body: unknown = await request.json();
    const parsed = createProductBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const product = await productService.createProduct({
      folderId,
      values: parsed.data.values,
      fieldAnnotations: parsed.data.fieldAnnotations,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        return mapProductError(domainError);
      }

      return null;
    });
  }
}
