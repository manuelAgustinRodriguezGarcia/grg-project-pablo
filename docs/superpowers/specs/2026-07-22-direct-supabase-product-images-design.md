# Direct Supabase upload for catalog product/column images

**Date:** 2026-07-22  
**Status:** Approved  
**Goal:** Bypass Vercel 4.5MB body limit for product-linked images, replace, column help, and field help — same UX/modals.

## Design

For each path: JSON intent → signed upload to bucket → JSON finalize → server downloads, validates, thumbnails, DB (same as today).

| Path | Bucket |
|------|--------|
| upload/replace product image | PRODUCT_IMAGES |
| column help | COLUMN_HELP_IMAGES |
| field help | PRODUCT_FIELD_HELP_IMAGES |

Client helpers keep the same public signatures. Cover image out of scope.
