import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const columns = await productService.listFolderTableColumns(folderId);
    return NextResponse.json({ columns });
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
