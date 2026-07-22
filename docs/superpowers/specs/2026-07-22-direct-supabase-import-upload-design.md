# Direct Supabase upload for import wizard (Vercel 4.5MB bypass)

**Date:** 2026-07-22  
**Status:** Approved  
**Goal:** Let Excel + optional external images/ZIP bypass Vercel’s 4.5MB function body limit without changing wizard steps or UX for CATALOGOS or PRECIOS.

## Constraints

- Same wizard steps, labels, and flow for catalog and price modes.
- Same buckets and path conventions (`excel-originals` / `imports/...`, `temp-imports` / `imports/{jobId}/external/...`).
- Server still creates `UploadedFile` + `ImportJob` and runs `analyzeJob` as today.
- Admin auth required to mint signed upload URLs and to register jobs.

## Design

### Flow (invisible to user)

1. Client `handleUploadContinue` (same button/step).
2. `POST /api/admin/imports/upload-intent` with JSON metadata only (filename, size, mime, optional image entries) → server validates, returns signed upload targets (token/URL + storagePath) for Excel and each optional image/ZIP.
3. Browser `PUT`s/uploads each file directly to Supabase Storage via signed upload.
4. `POST /api/admin/imports/register` with JSON `{ excel: { storagePath, ... }, externalImages?: [...] }` → server verifies objects exist (optional head/list), creates `UploadedFile` + `ImportJob`, stages external image refs on the job (same as `uploadImportImages` outcome).
5. Existing `prepareJobForDestination` / `analyzeImportAction` unchanged.

### Storage

- Add `createSignedUploadUrl(bucket, path, expiresIn)` using Supabase admin client (`createSignedUploadUrl`).
- Paths still from `buildStoragePath`.
- Keep existing `uploadFile` for other server-side uploads (product images, etc.).

### Client

- Replace FormData POST of file bytes in `ImportWizard.handleUploadContinue` with intent → direct upload → register.
- Optional images: same `appendExternalImages` selection UI; upload each via signed URL instead of FormData.
- Overlay copy stays “Subiendo archivo…”.

### Fallback

- Always use direct upload (simpler, predictable on Vercel). Local and prod same path.

### Out of scope

- Changing destination/config/apply steps.
- Migrating product image gallery uploads (separate flows).
- Changing 50MB app-level max size rules.

## Risks / mitigations

- Orphan objects if client dies after Storage PUT: register is best-effort; retention purge can clean unused temp/excel later (existing retention patterns).
- Signed URL expiry: short TTL (e.g. 10 min); fail with clear retry message.
- CSP already allows `connect-src https://*.supabase.co`.

## Spec self-review

- No unresolved placeholders.
- Wizard steps/UX explicitly out of scope and unchanged.
- Excel + external ZIP/images covered (option B).
- Old `POST /api/admin/imports/upload` FormData route remains for compatibility; wizard uses intent → direct → finalize.
