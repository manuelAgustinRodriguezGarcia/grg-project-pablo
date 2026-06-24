# ENDPOINTS — Referencia para frontend

> Contratos de API y Server Actions **implementados** (Fases 2–7 backend). Contexto compacto: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md). Plan: [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md). Producto: [`PRD.md`](./PRD.md).  
> Última actualización: 2026-06-24 (búsqueda y filtros Fase 7).

---

## Estado de integración

| Recurso | En UI | Dónde / notas |
|---------|-------|---------------|
| `loginFormAction` | ✅ | `LoginFormCard` → `/auth/login` |
| `logoutFormAction` | ✅ | `AdminSignOutButton` → sidebar admin |
| `requireAuthOrRedirect` | ✅ | `src/app/admin/layout.tsx` |
| `CatalogNavigator` | ⚠️ mock | `/admin/catalogos` usa `mockCatalogNavigator.data.ts`; **pendiente** cablear APIs abajo |
| `GET /api/admin/session` | ❌ | Hidratar sesión en cliente |
| `GET /api/admin/directory` | ❌ | Tarjetas de catálogos (directorio) |
| `GET /api/admin/catalogs/{id}/navigation` | ❌ | Selector catálogo → carpetas |
| `GET /api/admin/folders/{id}/products` | ❌ | Tabla paginada; admite `q` y `filters` (Fase 7) |
| `GET /api/admin/catalogs/{id}/search` | ❌ | Búsqueda en catálogo |
| `GET /api/admin/search/global` | ❌ | Búsqueda global |
| CRUD productos / equivalencias / imágenes manuales (REST + actions) | ❌ | APIs Fase 6 listas; UI formulario/edición pendiente |
| Acciones de usuarios | ❌ | Falta `/admin/users` |
| Acciones de catálogos / carpetas / columnas | ❌ | CRUD admin sin UI |
| Ayuda contextual columnas (REST + actions) | ❌ | Backend listo; UI ícono Info / popover / modal pendiente |
| Importador Excel (REST + actions) | ❌ | APIs listas; UI `/admin/archivos` pendiente |
| Imágenes import / galería producto (REST + actions) | ❌ | APIs Fase 5 listas; UI revisión/modal pendiente |
| `requestPasswordResetAction` / `updatePasswordAction` | ❌ | Faltan `/auth/forgot-password` y `/auth/reset-password` |

**Flujo sugerido para reemplazar mocks en `/admin/catalogos`:**

1. `GET /api/admin/directory` → listar catálogos activos (tarjetas o dropdown).
2. Al elegir catálogo → `GET /api/admin/catalogs/{catalogId}/navigation` → carpetas.
3. Al elegir carpeta → `GET /api/admin/folders/{folderId}/products?page=&pageSize=&q=&filters=` → columnas + filas + pills.

**Debounce recomendado (UI):** 250–300 ms al escribir en `q` o filtros de columna.

---

## Convenciones

### Tipos de integración

| Tipo | Uso | Código |
|------|-----|--------|
| **Route Handler (REST)** | `fetch` desde cliente o hooks | `src/app/api/**/route.ts` |
| **Server Action** | Formularios y mutaciones del panel | `src/features/**/actions/*.ts` |
| **Callback auth** | Enlace de correo Supabase (redirección, no `fetch`) | `src/app/auth/callback/route.ts` |

### Autenticación y roles

- Sesión vía **cookies Supabase** (`@supabase/ssr`). Mismo origen: no enviar tokens manualmente.
- `/admin` y `/api/admin/*` protegidos por middleware. Sin sesión: páginas → `/auth/login?redirectTo=…`; APIs → `401 { "error": "No autenticado" }`.
- **`redirectTo`** validado con `resolveSafeRedirectPath` (solo rutas internas; evita open redirect).
- **Rate limit (middleware):** `POST /auth/login` → 10 req/min por IP; `POST /api/admin/imports/*` → 20 req/min. Respuesta `429` con header `Retry-After`.
- Roles: `ADMIN` | `CONSULTA` (usuario normal del PRD). Mutaciones de usuarios/catálogos/carpetas/columnas/importación/imágenes: solo `ADMIN`.
- **`VisibilityService`:** rol `CONSULTA` no ve catálogos/carpetas/columnas con `visibleToNormalUser = false`; recibe `404` en GET si el padre está oculto.

### Formato Server Actions

```ts
{ success: true, data: T }
{ success: false, error: string, code?: string }
```

Excepciones: `signInAction` / `loginFormAction` redirigen en éxito (`redirect()`); `logoutFormAction` redirige a `/auth/login`.

### Enums frecuentes

| Campo | Valores |
|-------|---------|
| `role` | `ADMIN` \| `CONSULTA` |
| `user.status` | `ACTIVE` \| `INACTIVE` |
| `catalog.status` | `ACTIVE` \| `INACTIVE` \| `HIDDEN` |
| `folder.status` | `ACTIVE` \| `INACTIVE` |
| `column.dataType` | `TEXT` \| `NUMBER` \| `BOOLEAN` \| `DATE` \| `DATETIME` \| `IMAGE` \| `FORMULA` \| `UNKNOWN` |
| `importJob.status` | `STORED` \| `ANALYZING` \| `PENDING_DESTINATION` \| `PENDING_CONFIG` \| `PROCESSING` \| `READY_TO_APPLY` \| `PENDING_REVIEW` \| `PUBLISHED` \| `FAILED` \| `CANCELLED` |
| `importActionType` | `IMPORTAR_LISTA` \| `COMBINAR_LISTA` \| `REEMPLAZAR_LISTA` |
| `importSheet.classification` | `IMPORTABLE` \| `INDEX` \| `AUXILIARY` \| `IGNORED` |
| `productImage.status` | `ASSOCIATED_AUTO` \| `ASSOCIATED_MANUAL` \| `PENDING_REVIEW` \| `FILE_NOT_FOUND` \| `AMBIGUOUS` \| `DUPLICATE_NAME` \| `FORMAT_REJECTED` \| `DELETED` |
| `productImage.source` | `EMBEDDED` \| `EXTERNAL_ZIP` \| `EXTERNAL_UPLOAD` \| `MANUAL` |

### Modelo de dominio

```text
Catálogo → Carpeta → Producto
         └─ FolderColumn (configuración de columnas)
```

| PRD (UI) | API / Prisma |
|----------|--------------|
| Carpeta | `CatalogFolder` |
| Producto | `Product` |
| Usuario normal | rol `CONSULTA` |
| `sectionCount` (legacy en directorio) | Cantidad de **carpetas visibles** — mostrar como carpetas en UI |

Validación detallada: schemas Zod en `src/features/**/schemas/*.ts`. Tipos: `src/features/**/types/*.ts`.

---

## REST — Route Handlers

Todas requieren cookie de sesión. Errores habituales: `401` no autenticado; `403` sin permiso (`FORBIDDEN`); `404` recurso inexistente u oculto para `CONSULTA`; `400` validación (`VALIDATION_ERROR`); `409` estado inválido (`INVALID_STATE`); `429` rate limit. Mapeo centralizado en `src/server/api/admin-api-error.ts`.

### `GET /api/admin/session`

Perfil del usuario autenticado.

**200:** `{ id, email, name, role, status }`  
**401:** `{ "error": "No autenticado" }`

```ts
const session = await fetch("/api/admin/session").then((r) => r.ok ? r.json() : null);
```

→ `src/app/api/admin/session/route.ts`

---

### `GET /api/admin/directory`

Directorio de catálogos **activos**, ordenados por `order`. Auto-incluye catálogos nuevos sin cambios de código.

**200:**

```json
{
  "catalogs": [
    {
      "id": "clx...",
      "name": "Rulemanes",
      "description": "...",
      "coverImageUrl": "https://...signed...",
      "sectionCount": 2,
      "updatedAt": "2026-06-18T12:00:00.000Z",
      "order": 0,
      "offlineSync": { "status": "unavailable" }
    }
  ],
  "generatedAt": "2026-06-18T12:00:00.000Z"
}
```

| Campo | Notas |
|-------|-------|
| `coverImageUrl` | URL firmada temporal; `null` sin imagen |
| `sectionCount` | Carpetas visibles según rol |
| `offlineSync.status` | Placeholder hasta Fase 9 |

→ `src/features/directory/types/directory.types.ts`

---

### `GET /api/admin/catalogs/{catalogId}/navigation`

Metadatos del catálogo y carpetas visibles (`ACTIVE` + visibles para el rol).

**200:**

```json
{
  "catalog": {
    "id": "clx...",
    "name": "Rulemanes",
    "description": "...",
    "coverImageUrl": "https://...",
    "order": 0,
    "visibleToNormalUser": true,
    "updatedAt": "2026-06-19T12:00:00.000Z"
  },
  "folders": [
    {
      "id": "clx...",
      "name": "Rodamientos",
      "description": null,
      "order": 0,
      "visibleToNormalUser": true,
      "productCount": 42,
      "updatedAt": "2026-06-19T12:00:00.000Z"
    }
  ],
  "generatedAt": "2026-06-19T12:00:00.000Z"
}
```

→ `src/features/catalog/types/navigation.types.ts`

---

### `GET /api/admin/folders/{folderId}/products`

Columnas visibles + productos paginados, con búsqueda y filtros opcionales.

**Query:** `page` (default `1`), `pageSize` (default `50`, máx. `200`), `q` (texto, máx. 200), `filters` (JSON URL-encoded: `[{ columnInternalKey, operator: "contains"|"equals", value }]`).

**200:** `ProductTableResponse` — `folder`, `columns`, `products`, `pagination`, `search` (`{ query, normalizedQuery }` | `null`), `activeFilters` (pills para UI).

Ejemplo completo: [`docs/api/examples/folder-products.json`](./api/examples/folder-products.json).

`CONSULTA`: `dynamicData` excluye columnas ocultas. Respeta `searchConfig`/`filterConfig` de carpeta ∩ flags `isSearchable`/`isFilterable`.

→ `src/features/catalog/schemas/search.schemas.ts` · `src/server/services/product.service.ts`

---

### `GET /api/admin/catalogs/{catalogId}/search`

Búsqueda en todas las carpetas visibles del catálogo. Cada ítem incluye carpeta de origen.

**Query:** `q` (obligatorio), `page`, `pageSize`.

**200:** `{ catalog, search, items[], pagination }` — cada `item`: `productId`, `primaryCode`, `description`, `matchType`, `matchValue`, `folder`, `catalog`, `primaryImage`.

→ `src/app/api/admin/catalogs/[catalogId]/search/route.ts`

---

### `GET /api/admin/search/global`

Búsqueda en catálogos/carpetas activos visibles. Filtro global opcional por campo mapeado.

**Query:** `q` o (`globalFieldKey` + `globalFieldValue`), `page`, `pageSize`, `catalogId?`, `folderId?`.

**200:** `{ search, items[], pagination }` — misma forma de `item` que búsqueda por catálogo.

→ `src/app/api/admin/search/global/route.ts`

---

### `POST /api/admin/folders/{folderId}/products`

Crea un producto manual en la carpeta. Solo `ADMIN`. Valida columnas según `FolderColumn` (`isAdminEditable`, `isRequired`, `isReadOnly`).

**Body JSON:** `{ "values": { "<internalKey>": <valor>, ... } }`

**201:** `ProductDetail` (producto + equivalencias parseadas + `createdAt`/`updatedAt`).

**400:** `VALIDATION_ERROR` | `COLUMN_NOT_EDITABLE`

→ `src/app/api/admin/folders/[folderId]/products/route.ts`

---

### `GET /api/admin/products/{productId}`

Detalle de producto para edición admin. **200:** `ProductDetail`.

---

### `PATCH /api/admin/products/{productId}`

Actualiza valores de columnas editables. **Body:** `{ "values": { ... } }`. **200:** `ProductDetail`.

---

### `DELETE /api/admin/products/{productId}`

Elimina producto, imágenes asociadas (Storage best-effort) y equivalencias. **200:** `{ "success": true }`.

---

### `POST /api/admin/products/{productId}/duplicate`

Duplica producto (sufijo `(copia)` en código principal), imágenes en Storage y equivalencias. **201:** `ProductDetail`.

→ `src/app/api/admin/products/[productId]/route.ts`, `.../duplicate/route.ts`

---

### `GET /api/admin/products/{productId}/equivalences`

Lista códigos equivalentes normalizados del producto. Solo `ADMIN`.

**200:** `{ "productId": "clx...", "equivalences": EquivalenceListItem[] }`

---

### `POST /api/admin/products/{productId}/equivalences`

Agrega equivalencia manual. **Body:** `{ "originalCode": "0193-SILVA" }`. **201:** `EquivalenceListItem`.

**400:** `DUPLICATE_CODE` | `VALIDATION_ERROR`

---

### `DELETE /api/admin/products/{productId}/equivalences/{equivalenceId}`

Elimina una equivalencia. **200:** `{ "success": true }`.

→ `src/app/api/admin/products/[productId]/equivalences/`

---

### Imágenes manuales de producto

Además del `GET` de galería (Fase 5):

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/products/{productId}/images` | `multipart/form-data`: `file` (+ opc. `isPrimary`, `sortOrder`, `label`) |
| `PATCH` | `.../images/{imageId}` | JSON metadatos **o** `multipart` con `file` para reemplazar imagen |
| `DELETE` | `.../images/{imageId}` | Soft-delete (`status: DELETED`) |

`source: MANUAL` · `status: ASSOCIATED_MANUAL` · bucket `product-images`.

→ `src/app/api/admin/products/[productId]/images/`

---

### `POST /api/admin/imports/upload`

Sube Excel (`.xlsx`/`.xlsm`), respalda en bucket `excel-originals` **antes** de analizar. Solo `ADMIN`.

**Body:** `multipart/form-data`:

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `file` | Sí | Archivo Excel |
| `imagesZip` | No | ZIP con imágenes externas (Embragues, etc.) |
| `images` | No | Una o más imágenes sueltas (repetir campo) |

**201:** `{ "jobId": "clx...", "uploadedFileId": "clx..." }`

**400:** `{ "error": "...", "code": "INVALID_FILE" | "VALIDATION_ERROR" }`

→ `src/app/api/admin/imports/upload/route.ts`

---

### `GET /api/admin/imports/{jobId}`

Estado del job de importación. **200:** `ImportJobDetail` (`src/features/imports/types/import-job.types.ts`).

---

### `GET /api/admin/imports/{jobId}/sheets`

Hojas detectadas tras `analyzeImportAction`. **200:** `{ jobId, sheets: ImportSheetItem[] }`.

---

### `GET /api/admin/imports/{jobId}/preview`

Vista previa paginada. **Query:** `page`, `pageSize`. Productos con `isMatch: true` = coincidencia.

---

### `GET /api/admin/imports/{jobId}/report`

Informe final. Jobs `PUBLISHED`, `PENDING_REVIEW` o `FAILED`. **200:** `{ jobId, status, report, errorMessage, finishedAt }`.

El `report` incluye métricas de imágenes: `imagesDetected`, `imagesExtracted`, `imagesAssociated`, `imagesPendingReview`, `imagesRejected`, `imagesAmbiguous`.

---

### `POST /api/admin/imports/{jobId}/images`

Sube imágenes externas a un job existente (estados `STORED`–`READY_TO_APPLY`). Solo `ADMIN`.

**Body:** `multipart/form-data` — `imagesZip` (File) y/o `images` (File[], `.jpg/.jpeg/.png/.webp`).

**200:** `{ "jobId": "clx...", "status": "READY_TO_APPLY" }`

→ `src/app/api/admin/imports/[jobId]/images/route.ts`

---

### `GET /api/admin/imports/{jobId}/images/review`

Listado paginado de imágenes del job para revisión. Solo `ADMIN`.

**Query:** `page`, `pageSize`, `status?` (`PENDING_REVIEW`, `AMBIGUOUS`, `ASSOCIATED_AUTO`, …)

**200:**

```json
{
  "jobId": "clx...",
  "items": [
    {
      "id": "clx...",
      "productId": null,
      "originalName": "PLACA-55120IAR.jpg",
      "status": "PENDING_REVIEW",
      "source": "EXTERNAL_ZIP",
      "thumbnailUrl": "https://...signed...",
      "fullUrl": "https://...signed...",
      "matchCandidates": null,
      "sourceRow": null,
      "sourceColumn": null
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 3, "totalPages": 1 }
}
```

→ `src/app/api/admin/imports/[jobId]/images/review/route.ts`

---

### `PATCH /api/admin/imports/{jobId}/images/{imageId}`

Asociar imagen a producto o actualizar metadatos. Solo `ADMIN`.

**Body JSON:** `{ "productId"?: string, "isPrimary"?: boolean, "sortOrder"?: number, "label"?: string | null }` (≥1 campo).

**200:** `ImportImageReviewItem` (mismo shape que ítem de review).

---

### `DELETE /api/admin/imports/{jobId}/images/{imageId}`

Soft-delete (`status: DELETED`). **200:** `{ "success": true }`

---

### `GET /api/admin/products/{productId}/images`

Galería del producto con URLs firmadas. `ADMIN` y `CONSULTA` (respeta visibilidad carpeta/catálogo).

**200:** `{ "productId": "clx...", "images": ImportImageReviewItem[] }`

→ `src/app/api/admin/products/[productId]/images/route.ts`

---

### `GET /auth/callback`

Intercambia `code` de Supabase por sesión. URL del correo, no `fetch`.

| Query | Descripción |
|-------|-------------|
| `code` | Obligatorio |
| `next` | Destino tras éxito (default `/admin`; usar `/auth/reset-password` en recuperación) |

| Caso | Resultado |
|------|-----------|
| Sin `code` | → `/auth/login` |
| Error | → `/auth/login?error=auth_callback_failed` |
| Éxito | → `next` |

---

## Server Actions — Autenticación

Import base: `@/features/auth/actions/auth.actions` (salvo wrappers de formulario).

| Acción | Auth | Entrada | Resultado | UI |
|--------|------|---------|-----------|-----|
| `loginFormAction` | Pública | `FormData`: `email`, `password`, `redirectTo?` | Éxito: redirect; error: `{ success: false, error, code? }` | `LoginFormCard` |
| `signInAction` | Pública | `{ email, password }`, `redirectTo?` | Igual que arriba | Wrapper interno |
| `logoutFormAction` | Sesión | — | Redirect `/auth/login` o `?error=logout_failed` | `AdminSignOutButton` |
| `signOutAction` | Sesión | — | `{ success: true, data: { clearOfflineData: true, signal: "grg:offline:clear" } }` | Lógica interna |
| `requestPasswordResetAction` | Pública | `{ email }` | `{ success, data? \| error, code? }` | Pendiente UI |
| `updatePasswordAction` | Sesión | `{ password, confirmPassword }` (8–72 chars) | `{ success, data? \| error, code? }` | Pendiente UI |

**Códigos auth:** `INVALID_CREDENTIALS`, `USER_INACTIVE`, `AUTH_PROVIDER_ERROR`.

**Query `/auth/login`:** `redirectTo` (default `/admin`), `error` (`logout_failed`, `auth_callback_failed`).

---

## Server Actions — Usuarios (solo `ADMIN`)

Import: `@/features/users/actions/user.actions`

| Acción | Entrada | Respuesta `data` | Códigos de error |
|--------|---------|------------------|------------------|
| `listUsersAction` | — | `UserListItem[]` | `FORBIDDEN` |
| `createUserAction` | `{ email, password, name, role }` | `UserListItem` | `EMAIL_ALREADY_EXISTS`, `VALIDATION_ERROR`, `FORBIDDEN` |
| `updateUserAction` | `{ id, name?, role? }` (≥1 campo) | `UserListItem` | `USER_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN` |
| `activateUserAction` | `{ userId }` | `UserListItem` | `USER_NOT_FOUND`, `FORBIDDEN` |
| `deactivateUserAction` | `{ userId }` | `UserListItem` | `CANNOT_DEACTIVATE_SELF`, `USER_NOT_FOUND`, `FORBIDDEN` |

**`UserListItem`:** `{ id, name, email, role, status, lastAccessAt, createdAt }` (fechas ISO).

---

## Server Actions — Catálogos (solo `ADMIN`)

Import: `@/features/catalog/actions/catalog.actions`

| Acción | Entrada | Respuesta `data` | Notas |
|--------|---------|------------------|-------|
| `listCatalogsAction` | — | `CatalogListItem[]` | Todos los status, por `order` |
| `createCatalogAction` | `{ name, description?, status?, order?, visibleToNormalUser? }` | `CatalogListItem` | `order` auto si omitido |
| `updateCatalogAction` | `{ id, name?, description?, status? }` (≥1) | `CatalogListItem` | |
| `reorderCatalogsAction` | `{ items: [{ id, order }] }` | `CatalogListItem[]` | Lista completa |
| `setCatalogVisibilityAction` | `{ catalogId, visible }` | `CatalogListItem` | Afecta GET para `CONSULTA` |
| `deleteCatalogAction` | `{ catalogId }` | `undefined` | Cascada carpetas/productos; modal confirmación |
| `clearCatalogAction` | `{ catalogId }` | `{ deletedProductCount }` | Conserva estructura; modal confirmación |
| `setCoverImageAction` | `FormData`: `catalogId`, `file` | `CatalogListItem` | `.jpg/.jpeg/.png/.webp` → bucket `product-images` |
| `removeCoverImageAction` | `{ catalogId }` | `CatalogListItem` | |

**`CatalogListItem`:** `{ id, name, description, coverImagePath, status, order, visibleToNormalUser, folderCount, createdAt, updatedAt }`.

**Errores:** `CATALOG_NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATUS`, `FORBIDDEN`, `UNAUTHENTICATED`.

---

## Server Actions — Carpetas (solo `ADMIN`)

Import: `@/features/catalog/actions/folder.actions`

| Acción | Entrada | Respuesta `data` | Notas |
|--------|---------|------------------|-------|
| `listFoldersAction` | `{ catalogId }` | `FolderListItem[]` | |
| `createFolderAction` | `{ catalogId, name, description?, status?, order?, visibleToNormalUser? }` | `FolderListItem` | |
| `createFolderFromSheetAction` | `{ catalogId, sheetName, description? }` | `FolderListItem` | Para importador (Fase 4) |
| `updateFolderAction` | `{ id, name?, description?, status? }` (≥1) | `FolderListItem` | |
| `reorderFoldersAction` | `{ catalogId, items: [{ id, order }] }` | `FolderListItem[]` | IDs del mismo catálogo |
| `setFolderVisibilityAction` | `{ folderId, visible }` | `FolderListItem` | |
| `deleteFolderAction` | `{ folderId }` | `undefined` | Cascada columnas/productos; modal |
| `clearFolderAction` | `{ folderId }` | `{ deletedProductCount }` | Conserva carpeta/columnas; modal |
| `setFolderSearchConfigAction` | `{ folderId, config: FolderColumnKeysConfig \| null }` | `FolderListItem` | Motor búsqueda ✅ (consumido en listado Fase 7) |
| `setFolderFilterConfigAction` | `{ folderId, config: FolderColumnKeysConfig \| null }` | `FolderListItem` | Motor filtros ✅ (consumido en listado Fase 7) |

**`FolderListItem`:** `{ id, catalogId, name, description, status, order, visibleToNormalUser, searchConfig, filterConfig, productCount, createdAt, updatedAt }`.

**`FolderColumnKeysConfig`:** `{ columnInternalKeys: string[] }` (máx. 100, sin duplicados). `null` resetea.

**Errores:** `FOLDER_NOT_FOUND`, `CATALOG_NOT_FOUND`, `FOLDER_DUPLICATE_NAME`, `VALIDATION_ERROR`, `INVALID_STATUS`, `FORBIDDEN`, `UNAUTHENTICATED`.

---

## Server Actions — Columnas

Import: `@/features/catalog/actions/column.actions`

| Acción | Auth | Entrada | Respuesta `data` |
|--------|------|---------|------------------|
| `listColumnsAction` | Sesión (CONSULTA filtrado) | `{ folderId }` | `ColumnListItem[]` |
| `createColumnAction` | ADMIN | Ver `createColumnSchema` | `ColumnListItem` |
| `updateColumnAction` | ADMIN | Ver `updateColumnSchema` | `ColumnListItem` |
| `reorderColumnsAction` | ADMIN | `{ folderId, items: [{ id, order }] }` | `ColumnListItem[]` |
| `setColumnVisibilityAction` | ADMIN | `{ id, visible }` | `ColumnListItem` |
| `deleteColumnAction` | ADMIN | `{ id }` | `undefined` |

Import ayuda contextual: `@/features/catalog/actions/column-help.actions`

| Acción | Auth | Entrada | Respuesta `data` |
|--------|------|---------|------------------|
| `getColumnHelpAction` | Sesión (CONSULTA filtrado) | `{ columnId }` | `ColumnListItem` |
| `deleteColumnHelpImageAction` | ADMIN | `{ columnId }` | `ColumnListItem` |

El texto de ayuda (`helpText`) y el alt de imagen (`helpImageAltText`) se editan con `updateColumnAction`.

**`ColumnListItem`:** metadatos completos — `id`, `folderId`, `originalName`, `displayName`, `internalKey`, `dataType`, `order`, `visibleToNormalUser`, flags (`isSearchable`, `isFilterable`, `isPrimaryCode`, `isDescription`, `isImageCode`, …), `globalFieldKey`, `width`, `format`, `unit`, `label`, ayuda contextual (`helpText`, `helpImageAltText`, `hasContextualHelp`, `helpImagePreviewUrl`, `helpImageFullUrl`), timestamps.

**Errores:** `FOLDER_NOT_FOUND`, `COLUMN_DUPLICATE_KEY`, `COLUMN_PRIMARY_CODE_CONFLICT`, `COLUMN_NOT_FOUND`, `HELP_IMAGE_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`.

Campos opcionales de create/update: ver `src/features/catalog/schemas/column.schemas.ts`. `originalName` no es editable en update (RF-049).

---

### `GET /api/admin/columns/{columnId}/help`

Detalle de ayuda contextual de una columna (texto + URLs firmadas de imagen). Respeta visibilidad por rol.

**200:** `{ "column": ColumnListItem }`

**404:** `COLUMN_NOT_FOUND` | `FOLDER_NOT_FOUND` | `CATALOG_NOT_FOUND`

→ `src/app/api/admin/columns/[columnId]/help/route.ts`

---

### `POST /api/admin/columns/{columnId}/help-image`

Sube o reemplaza la imagen de ayuda de una columna. Solo `ADMIN`.

**Body:** `multipart/form-data` — `file` (obligatorio), `altText` (opcional).

**201:** `{ "column": ColumnListItem }`

**400:** `VALIDATION_ERROR` · **404:** `COLUMN_NOT_FOUND`

---

### `DELETE /api/admin/columns/{columnId}/help-image`

Elimina la imagen de ayuda de una columna. Solo `ADMIN`. Conserva `helpText` si existe.

**200:** `{ "column": ColumnListItem }`

**404:** `COLUMN_NOT_FOUND` | `HELP_IMAGE_NOT_FOUND`

→ `src/app/api/admin/columns/[columnId]/help-image/route.ts`

---

## Server Actions — Productos (solo `ADMIN`)

Import: `@/features/records/actions/product.actions`

| Acción | Entrada | Respuesta `data` | Notas |
|--------|---------|------------------|-------|
| `getProductAction` | `{ productId }` | `ProductDetail` | Incluye equivalencias y timestamps |
| `createProductAction` | `{ folderId, values }` | `ProductDetail` | Valida según columnas de la carpeta |
| `updateProductAction` | `{ productId, values }` | `ProductDetail` | Merge con valores actuales |
| `deleteProductAction` | `{ productId }` | `undefined` | |
| `duplicateProductAction` | `{ productId }` | `ProductDetail` | Copia imágenes y equivalencias |
| `listEquivalencesAction` | `{ productId }` | `EquivalenceListItem[]` | |
| `addEquivalenceAction` | `{ productId, originalCode }` | `EquivalenceListItem` | |
| `removeEquivalenceAction` | `{ productId, equivalenceId }` | `undefined` | |

**Errores:** `PRODUCT_NOT_FOUND`, `FOLDER_NOT_FOUND`, `VALIDATION_ERROR`, `COLUMN_NOT_EDITABLE`, `DUPLICATE_CODE`, `EQUIVALENCE_NOT_FOUND`, `FORBIDDEN`.

Schemas: `src/features/records/schemas/product.schemas.ts` · Tipos: `src/features/records/types/product.types.ts`

---

## Server Actions — Imágenes manuales de producto (solo `ADMIN`)

Import: `@/features/product-images/actions/product-image.actions`

| Acción | Entrada | Respuesta `data` |
|--------|---------|------------------|
| `uploadProductImageAction` | `FormData`: `productId`, `file`, opc. `isPrimary`, `sortOrder`, `label` | `ProductImageReviewItem` |
| `replaceProductImageAction` | `FormData`: `productId`, `imageId`, `file` | `ProductImageReviewItem` |
| `updateProductImageAction` | `{ productId, imageId, isPrimary?, sortOrder?, label? }` | `ProductImageReviewItem` |
| `deleteProductImageAction` | `{ productId, imageId }` | `undefined` |

**Códigos error:** `IMAGE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`.

---

## Server Actions — Importación (solo `ADMIN`)

Import: `@/features/imports/actions/import.actions`

**Flujo asistente:** upload [+ imágenes opc.] → `analyzeImportAction` → `setImportDestinationAction` → `setImportConfigAction` → preview GET → [`POST .../images` opc.] → `applyImportAction` → [`image review` si `PENDING_REVIEW`] → `completeImageReviewAction`.

| Acción | Entrada | Respuesta `data` | Notas |
|--------|---------|------------------|-------|
| `analyzeImportAction` | `{ jobId }` | `ImportJobDetail` | → `PENDING_DESTINATION` |
| `setImportDestinationAction` | `{ jobId, catalogId, folderId, sheetName }` | `ImportJobDetail` | Hoja `IMPORTABLE` |
| `setImportConfigAction` | `{ jobId, columnMapping?, primaryCodeColumnKey?, descriptionColumnKey? }` | `ImportJobDetail` | → `READY_TO_APPLY` |
| `applyImportAction` | `{ jobId, actionType, confirmed }` | `ImportJobDetail` | → `PUBLISHED` o `PENDING_REVIEW` |
| `listImportImageReviewAction` | `{ jobId, page?, pageSize?, status? }` | `ImportImageReviewResponse` | Panel revisión |
| `associateImportImageAction` | `{ jobId, imageId, productId }` | `ImportImageReviewItem` | Asociación manual |
| `updateImportImageAction` | `{ jobId, imageId, isPrimary?, sortOrder?, label? }` | `ImportImageReviewItem` | Principal / orden / etiqueta |
| `deleteImportImageAction` | `{ jobId, imageId }` | `{ success: true }` | Soft-delete |
| `completeImageReviewAction` | `{ jobId }` | `ImportJobDetail` | `PENDING_REVIEW` → `PUBLISHED` |
| `cancelImportAction` | `{ jobId }` | `ImportJobDetail` | → `CANCELLED` |

**Confirmaciones:** `COMBINAR_LISTA` / `REEMPLAZAR_LISTA` requieren `confirmed: true`. `IMPORTAR_LISTA` solo si carpeta vacía.

**Códigos error import:** `IMPORT_NOT_FOUND`, `INVALID_STATE`, `INVALID_FILE`, `FOLDER_NOT_EMPTY`, `CONFIRMATION_REQUIRED`, `ANALYSIS_FAILED`, `PUBLISH_FAILED`, `SHEET_NOT_IMPORTABLE`, `VALIDATION_ERROR`.

**Códigos error imágenes:** `IMAGE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `IMPORT_NOT_FOUND`, `INVALID_STATE`, `VALIDATION_ERROR`, `FORBIDDEN`.

Schemas: `src/features/imports/schemas/import.schemas.ts`

---

## Rutas de la aplicación

### Público

| Ruta | Estado | Uso |
|------|--------|-----|
| `/` | ✅ | Landing Rothamel Repuestos |
| `/login` | ✅ | Alias → `/auth/login` |
| `/auth/login` | ✅ | Login (`redirectTo`, `error` en query) |
| `/auth/forgot-password` | ❌ | Middleware definido; sin página |
| `/auth/reset-password` | ❌ | Tras callback de recuperación |

Dominio producción: `www.rothamelrepuestos.com.ar` · `NEXT_PUBLIC_APP_URL` para enlaces de correo.

### Panel admin (protegido)

Navegación: `src/features/admin/data/adminNav.ts`. Destino post-login: `/admin`.

| Ruta | Estado | Uso |
|------|--------|-----|
| `/admin` | Placeholder | Home panel |
| `/admin/catalogos` | UI mock | `CatalogNavigator` — cablear REST arriba |
| `/admin/archivos` | Placeholder | Importador — **APIs listas**, UI pendiente |
| `/admin/users` | ❌ | Gestión usuarios |

---

## Auditoría (interno)

Sin endpoint de consulta. Eventos en `AuditLog`: login/logout, CRUD usuarios, CRUD/vaciado catálogos, `FILE_UPLOADED`, `IMPORT_PUBLISHED`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`, `PRODUCT_DUPLICATED`, `EQUIVALENCE_ADDED`, `EQUIVALENCE_REMOVED`, `PRODUCT_IMAGE_ASSOCIATED`, `PRODUCT_IMAGE_UPDATED`, `PRODUCT_IMAGE_DELETED`, `COLUMN_HELP_IMAGE_UPLOADED`, `COLUMN_HELP_IMAGE_DELETED`. Fallos de auditoría no interrumpen la operación.

---

## Pendiente (sin contrato aún)

Listado archivos subidos (Fase 8), offline/sync, **UI** productos/búsqueda/filtros/imágenes/ayuda columnas. Detalle: [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) · resumen: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md).

---

## Referencias rápidas

| Área | Archivos |
|------|----------|
| Auth | `src/features/auth/actions/`, `src/features/auth/schemas/auth.schemas.ts`, `src/server/auth/config.ts`, `rate-limit.ts`, `safe-redirect.ts` |
| Errores API admin | `src/server/api/admin-api-error.ts` |
| Usuarios | `src/features/users/actions/user.actions.ts`, `schemas/user.schemas.ts` |
| Catálogos | `src/features/catalog/actions/catalog.actions.ts`, `schemas/catalog.schemas.ts`, `types/catalog.types.ts` |
| Carpetas | `folder.actions.ts`, `schemas/folder.schemas.ts`, `types/folder.types.ts` |
| Columnas | `column.actions.ts`, `column-help.actions.ts`, `schemas/column.schemas.ts`, `types/column.types.ts` |
| Ayuda contextual columnas | `src/server/services/column-help.service.ts`, `src/app/api/admin/columns/` |
| Búsqueda / filtros | `src/server/search/`, `src/server/filters/`, `src/features/catalog/schemas/search.schemas.ts` |
| REST productos / navegación / búsqueda | `src/app/api/admin/folders/.../products/`, `.../catalogs/.../search/`, `.../search/global/` |
| Productos manuales | `src/features/records/`, `src/server/services/product.service.ts`, `product-field.builder.ts`, `equivalence.service.ts` |
| Importador | `src/app/api/admin/imports/`, `src/features/imports/actions/import.actions.ts`, `src/server/services/catalog-import.service.ts`, `src/server/importers/` |
| Imágenes | `src/server/image-processors/`, `src/server/services/image-*.service.ts`, `src/server/services/product-image.service.ts`, `src/server/repositories/product-image.repository.ts` |
| Directorio | `src/app/api/admin/directory/route.ts`, `src/features/directory/types/directory.types.ts` |
| UI catálogos (mock) | `src/features/catalog/components/CatalogNavigator.tsx`, `data/mockCatalogNavigator.data.ts` |
