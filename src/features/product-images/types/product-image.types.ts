import type { ProductImageReviewItem } from "@/server/services/product-image.service";

export type ProductImageActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type { ProductImageReviewItem };
