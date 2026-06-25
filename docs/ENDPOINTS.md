# ENDPOINTS — Referencia para frontend

> Contratos de API y Server Actions. Plan: [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) · Producto: [`PRD.md`](./PRD.md) · Import: [`METHOD-IMPORT.md`](./METHOD-IMPORT.md)  
> Última actualización: 2026-06-25

---

## Estado de integración UI

| Recurso | En UI | Notas |
|---------|-------|-------|
| `loginFormAction` / `logoutFormAction` | ✅ | Login y sidebar admin |
| `requireAuthOrRedirect` | ✅ | `admin/layout.tsx` |
| `CatalogNavigator` | ⚠️ mock | `/admin/catalogos` — pendiente cablear REST |
| REST lectura (directory, navigation, products, search) | ❌ | Backend listo |
| CRUD admin (usuarios, catálogos, carpetas, columnas, productos) | ❌ | Actions listas |
| Importador / imágenes / archivos / precios / offline | ❌ | Backend listo |
| `requestPasswordResetAction` / `updatePasswordAction` | ❌ | Faltan páginas auth |

**Flujo sugerido `/admin/catalogos`:** `GET /directory` → `GET /catalogs/{id}/navigation` → `GET /folders/{id}/products?page&pageSize&q&filters` (debounce 250–300 ms).

---

## Convenciones

| Tipo | Ubicación |
|------|-----------|
| Route Handler REST | `src/app/api/**/route.ts` |
| Server Action | `src/features/**/actions/*.ts` |
| Auth callback | `src/app/auth/callback/route.ts` |

- Sesión: cookies Supabase (`@supabase/ssr`). Sin sesión → `401` en APIs, redirect en páginas.
- Roles: `ADMIN` | `CONSULTA`. Mutaciones admin solo `ADMIN`.
- `VisibilityService`: `CONSULTA` no ve entidades con `visibleToNormalUser = false` → `404`.
- Rate limit: login 10/min, imports 20/min → `429` + `Retry-After`.
- Actions: `{ success: true, data }` | `{ success: false, error, code? }`. Login/logout redirigen.
- Errores API: `src/server/api/admin-api-error.ts` (`401`, `403`, `404`, `400`, `409`, `429`).
- Schemas/tipos: `src/features/**/schemas/*.ts`, `types/*.ts`.

**Enums frecuentes:** `role` · `importJob.status` · `importActionType` · `productImage.status` · `column.dataType` — ver schemas Zod.

**Dominio:** Catálogo → Carpeta → Producto. PRD «Carpeta» = `CatalogFolder`. `sectionCount` en directorio = carpetas visibles.

---

## REST — Implementados ✅

Índice compacto. Detalle en route handlers y tipos indicados.

### Sesión y directorio

| Método | Ruta | Respuesta | Archivo |
|--------|------|-----------|---------|
| `GET` | `/api/admin/session` | `{ id, email, name, role, status }` | `api/admin/session/route.ts` |
| `GET` | `/api/admin/directory` | `{ catalogs[], generatedAt }` — incluye `offlineSync` | `api/admin/directory/route.ts` |
| `GET` | `/api/admin/catalogs/{catalogId}/navigation` | `{ catalog, folders[], generatedAt }` | `api/admin/catalogs/[catalogId]/navigation/route.ts` |

### Productos, búsqueda y filtros

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/admin/folders/{folderId}/products` | Query: `page`, `pageSize`, `q`, `filters` (JSON). → `ProductTableResponse` |
| `GET` | `/api/admin/catalogs/{catalogId}/search` | Query: `q`, `page`, `pageSize` |
| `GET` | `/api/admin/search/global` | Query: `q` o `globalFieldKey`+`globalFieldValue`, filtros opcionales |
| `POST` | `/api/admin/folders/{folderId}/products` | Body: `{ values }` → `ProductDetail` |
| `GET/PATCH/DELETE` | `/api/admin/products/{productId}` | CRUD manual |
| `POST` | `/api/admin/products/{productId}/duplicate` | Copia producto + imágenes + equivalencias |
| `GET/POST/DELETE` | `/api/admin/products/{productId}/equivalences` | Equivalencias manuales |

Ejemplo `ProductTableResponse`: [`docs/api/examples/folder-products.json`](./api/examples/folder-products.json)

### Imágenes

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/admin/products/{productId}/images` | Galería con URLs firmadas |
| `POST/PATCH/DELETE` | `/api/admin/products/{productId}/images/{imageId?}` | Manuales: multipart o JSON metadatos |
| `POST` | `/api/admin/imports/upload` | Excel + opc. ZIP/imágenes → `{ jobId, uploadedFileId }` |
| `GET` | `/api/admin/imports/{jobId}` | `ImportJobDetail` |
| `GET` | `/api/admin/imports/{jobId}/sheets` | Hojas detectadas |
| `GET` | `/api/admin/imports/{jobId}/preview` | Vista previa paginada |
| `GET` | `/api/admin/imports/{jobId}/report` | Informe final |
| `POST` | `/api/admin/imports/{jobId}/images` | Imágenes externas al job |
| `GET` | `/api/admin/imports/{jobId}/images/review` | Revisión paginada |
| `PATCH/DELETE` | `/api/admin/imports/{jobId}/images/{imageId}` | Asociar / soft-delete |

Flujo import detallado: [`METHOD-IMPORT.md`](./METHOD-IMPORT.md)

### Ayuda contextual columnas

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/admin/columns/{columnId}/help` | `{ column: ColumnListItem }` |
| `POST/DELETE` | `/api/admin/columns/{columnId}/help-image` | Multipart `file` |

### Archivos subidos (RF-043)

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/admin/files` | Listado paginado, query `q` |
| `GET` | `/api/admin/files/{fileId}` | Detalle + historial jobs |
| `GET` | `/api/admin/files/{fileId}/download` | `{ url, expiresAt, originalName }` |
| `GET` | `/api/admin/files/{fileId}/report` | Informe; `?jobId=` opcional |
| `POST` | `/api/admin/files/{fileId}/reprocess` | Nuevo job sin re-upload → `{ jobId, uploadedFileId }` |
| `DELETE` | `/api/admin/files/{fileId}` | Body `{ confirmed: true }` si jobs publicados |

Actions: `src/features/files/actions/uploaded-file.actions.ts`

### Precios (RF-053–059)

| Método | Ruta | Notas |
|--------|------|-------|
| `GET/POST` | `/api/admin/price-lists` | Listado / crear |
| `GET/PATCH/DELETE` | `/api/admin/price-lists/{priceListId}` | CRUD lista |
| `POST` | `/api/admin/price-lists/{priceListId}/clear` | `{ deletedCount }` |
| `GET/POST` | `/api/admin/price-lists/{priceListId}/items` | Tabla paginada + crear ítem |
| `GET/PATCH` | `/api/admin/price-lists/{priceListId}/columns` | Config columnas |

Import destino precios: `destinationType: "PRICE_LIST"` en `setImportDestinationAction`. Actions: `src/features/prices/actions/price-list.actions.ts`

### Offline sync (RF-045–047)

| Método | Ruta | Notas |
|--------|------|-------|
| `GET` | `/api/admin/sync/manifest?deviceId=` | Manifest versionado + checksum |
| `GET` | `/api/admin/sync/catalogs/{catalogId}` | Bundle navegación |
| `GET` | `/api/admin/sync/folders/{folderId}` | Productos chunked (`cursor`, `chunkSize=500`) |
| `GET` | `/api/admin/sync/equivalences?catalogId=` | Mapa equivalencias |
| `GET` | `/api/admin/sync/thumbnails` | Miniaturas + URLs firmadas |
| `GET` | `/api/admin/sync/price-lists/{priceListId}` | Ítems chunked |

`signOutAction` devuelve `{ clearOfflineData: true, signal: "grg:offline:clear" }` para limpiar cache cliente.

### Auth callback

| Ruta | Query | Resultado |
|------|-------|-----------|
| `GET /auth/callback` | `code` (oblig.), `next` (default `/admin`) | Intercambia código Supabase → redirect |

---

## Server Actions — Implementadas ✅

Import desde los paths indicados. Solo `ADMIN` salvo donde se indica.

| Módulo | Actions principales | Import |
|--------|---------------------|--------|
| **Auth** | `loginFormAction`, `signInAction`, `logoutFormAction`, `signOutAction`, `requestPasswordResetAction`, `updatePasswordAction` | `@/features/auth/actions/auth.actions` |
| **Usuarios** | `list/create/update/activate/deactivateUserAction` | `@/features/users/actions/user.actions` |
| **Catálogos** | CRUD, reorder, visibility, clear, delete, cover image | `@/features/catalog/actions/catalog.actions` |
| **Carpetas** | CRUD, reorder, visibility, clear, search/filter config, `createFolderFromSheetAction` | `folder.actions.ts` |
| **Columnas** | CRUD, reorder, visibility, help (`column-help.actions`) | `column.actions.ts` |
| **Productos** | CRUD, duplicate, equivalences | `@/features/records/actions/product.actions` |
| **Imágenes producto** | upload, replace, update, delete | `@/features/product-images/actions/product-image.actions` |
| **Importación** | analyze, destination, config, apply, image review, cancel | `@/features/imports/actions/import.actions` |
| **Archivos** | reprocess, delete, detail, download URL, report | `uploaded-file.actions.ts` |
| **Precios** | CRUD listas, columnas, ítems | `price-list.actions.ts` |

**Códigos error frecuentes:** `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND` variants, `INVALID_STATE`, `CONFIRMATION_REQUIRED`, `ACTIVE_JOB_EXISTS` — por dominio en cada action.

---

## Rutas de aplicación — Implementadas ✅

| Ruta | Estado |
|------|--------|
| `/`, `/login`, `/auth/login` | ✅ |
| `/admin`, `/admin/catalogos` | Placeholder / mock |
| `/admin/archivos` | Placeholder (API lista) |

---

## Pendiente — Sin implementar ⏳

Detalle completo de lo que falta construir en frontend/cliente.

### Páginas auth

#### `/auth/forgot-password` ❌

Formulario de recuperación de contraseña.

| Campo | Tipo | Validación |
|-------|------|------------|
| `email` | email | obligatorio |

**Action:** `requestPasswordResetAction({ email })`  
**Éxito:** mensaje genérico (no revelar si el email existe).  
**Errores:** `VALIDATION_ERROR`, `AUTH_PROVIDER_ERROR`

**Flujo:** usuario envía email → Supabase envía enlace → callback con `next=/auth/reset-password`

#### `/auth/reset-password` ❌

Formulario tras callback de recuperación (sesión activa).

| Campo | Tipo | Validación |
|-------|------|------------|
| `password` | string | 8–72 caracteres |
| `confirmPassword` | string | debe coincidir |

**Action:** `updatePasswordAction({ password, confirmPassword })`  
**Éxito:** redirect a `/admin` o mensaje de confirmación.

**Callback:** `GET /auth/callback?code=…&next=/auth/reset-password`

---

### `/admin/users` ❌

Gestión de usuarios (solo `ADMIN`).

**Actions disponibles:**

| Acción | Entrada | Respuesta |
|--------|---------|-----------|
| `listUsersAction` | — | `UserListItem[]` |
| `createUserAction` | `{ email, password, name, role }` | `UserListItem` |
| `updateUserAction` | `{ id, name?, role? }` | `UserListItem` |
| `activateUserAction` | `{ userId }` | `UserListItem` |
| `deactivateUserAction` | `{ userId }` | `UserListItem` |

**`UserListItem`:** `{ id, name, email, role, status, lastAccessAt, createdAt }`

**UI sugerida:** tabla con filtros por rol/estado; modal crear/editar; confirmación al desactivar; no permitir desactivarse a sí mismo (`CANNOT_DEACTIVATE_SELF`).

---

### `/admin/precios` ❌ (RF-053–059)

Sección de listas de precios independientes de catálogos. Backend completo; falta UI.

**Funcionalidades esperadas:**

1. **Listado** — `GET /api/admin/price-lists` o `listPriceListsAction`
2. **CRUD lista** — crear, editar nombre/descripción/visibilidad, eliminar
3. **Config columnas** — `GET/PATCH …/columns` (displayName, visibilidad, flags semánticos, ayuda)
4. **Tabla ítems** — `GET …/items?page&pageSize&q` paginada
5. **CRUD ítem manual** — `POST …/items` con `{ values: { codigo, precio, … } }`
6. **Vaciar lista** — `POST …/clear` con confirmación
7. **Import Excel** — wizard existente con destino:

```json
{
  "destinationType": "PRICE_LIST",
  "priceListId": "clx…",
  "sheetName": "Hoja1"
}
```

Flujo: upload → analyze → destination → config → preview → apply (`IMPORTAR_LISTA` | `COMBINAR_LISTA` | `REEMPLAZAR_LISTA`) → `PUBLISHED` (sin imágenes).

**Visibilidad:** `CONSULTA` solo ve listas/columnas con `visibleToNormalUser = true`.

---

### Integración UI general ❌

Cablear mocks y placeholders a APIs ya documentadas en § REST implementados.

| Área | Componentes / rutas | APIs / Actions |
|------|---------------------|----------------|
| Navegador catálogos | `CatalogNavigator` | directory, navigation, folder products |
| Búsqueda | barra + pills | `q`, `filters`, catalog/global search |
| Formulario producto | crear/editar/duplicar | product actions + equivalences + imágenes |
| Importador catálogos | wizard 6 pasos | imports REST + actions |
| Revisión imágenes | panel post-import | `images/review`, associate, complete |
| Ayuda columnas | ícono Info, popover, modal | `columns/{id}/help`, `hasContextualHelp` |
| Archivos subidos | `/admin/archivos` | files REST + actions |
| Admin catálogos/carpetas/columnas | formularios CRUD | catalog/folder/column actions |

---

### Cliente offline / PWA ❌ (RF-045–047)

Backend de sync listo. Falta cliente.

**Requisitos:**

1. **Service Worker** — cache de assets estáticos
2. **IndexedDB** — almacenar bundles de sync (carpetas chunked, equivalencias, thumbnails, price lists)
3. **Sync inicial** — `GET /sync/manifest?deviceId={uuid}` → descargar bundles según manifest
4. **Estado directorio** — mostrar `offlineSync.status`: `unavailable` | `ready` + `lastServerVersion`
5. **Bloqueo mutaciones** — deshabilitar escritura cuando `!navigator.onLine`
6. **Logout** — escuchar señal `grg:offline:clear` de `signOutAction` y limpiar IndexedDB

**Payload version:** `OFFLINE_PAYLOAD_VERSION = 1`. Sin Excel originales offline.

**Endpoints sync:**

```text
GET /api/admin/sync/manifest?deviceId=
GET /api/admin/sync/catalogs/{catalogId}
GET /api/admin/sync/folders/{folderId}?cursor=&chunkSize=500
GET /api/admin/sync/equivalences?catalogId=
GET /api/admin/sync/thumbnails
GET /api/admin/sync/price-lists/{priceListId}?cursor=&chunkSize=500
```

**Manifest ejemplo:**

```json
{
  "version": 1,
  "manifestVersion": 2,
  "syncedAt": "2026-06-25T12:00:00.000Z",
  "checksum": "sha256…",
  "catalogs": [{ "id": "…", "name": "…", "folderIds": ["…"] }],
  "priceLists": [{ "id": "…", "name": "…" }]
}
```

---

## Referencias rápidas

| Área | Archivos |
|------|----------|
| Auth | `src/features/auth/`, `src/server/auth/` |
| Errores API | `src/server/api/admin-api-error.ts` |
| Catálogos / carpetas / columnas | `src/features/catalog/` |
| Productos / equivalencias | `src/features/records/`, `equivalence.service.ts` |
| Búsqueda / filtros | `src/server/search/`, `src/server/filters/` |
| Importador | `src/features/imports/`, `catalog-import.service.ts`, `src/server/importers/` |
| Archivos | `src/features/files/`, `uploaded-file.service.ts` |
| Imágenes | `src/server/image-processors/`, `product-image.service.ts` |
| Precios | `src/features/prices/`, `price-*.service.ts` |
| Offline | `src/features/offline/`, `offline-sync.service.ts` |
| Directorio | `directory.types.ts`, `directory/route.ts` |
