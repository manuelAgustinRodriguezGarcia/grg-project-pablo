import type { ProductDetail } from "@/server/services/product.service";
import type { EquivalenceListItem } from "@/server/services/equivalence.service";
import type { ProductImageReviewItem } from "@/server/services/product-image.service";

export type ProductActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type { ProductDetail, EquivalenceListItem, ProductImageReviewItem };
