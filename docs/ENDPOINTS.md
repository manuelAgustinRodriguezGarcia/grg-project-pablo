# ENDPOINTS — Referencia para frontend

> Contratos de API y Server Actions **implementados** (Fases 2–3.8). Plan futuro: [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md). Producto: [`PRD.md`](./PRD.md).  
> Última actualización: 2026-06-20.

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
| `GET /api/admin/folders/{id}/products` | ❌ | Tabla de productos paginada |
| Acciones de usuarios | ❌ | Falta `/admin/users` |
| Acciones de catálogos / carpetas / columnas | ❌ | CRUD admin sin UI |
| `requestPasswordResetAction` / `updatePasswordAction` | ❌ | Faltan `/auth/forgot-password` y `/auth/reset-password` |

**Flujo sugerido para reemplazar mocks en `/admin/catalogos`:**

1. `GET /api/admin/directory` → listar catálogos activos (tarjetas o dropdown).
2. Al elegir catálogo → `GET /api/admin/catalogs/{catalogId}/navigation` → carpetas.
3. Al elegir carpeta → `GET /api/admin/folders/{folderId}/products?page=&pageSize=` → columnas + filas.

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
- Roles: `ADMIN` | `CONSULTA` (usuario normal del PRD). Mutaciones de usuarios/catálogos/carpetas/columnas: solo `ADMIN`.
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

Todas requieren cookie de sesión. Errores habituales: `401` no autenticado; `404` recurso inexistente u oculto para `CONSULTA`; `400` validación (`VALIDATION_ERROR`).

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

Columnas visibles + productos paginados.

**Query:** `page` (default `1`), `pageSize` (default `50`, máx. `200`).

**200:**

```json
{
  "folder": { "id": "clx...", "name": "Rodamientos", "catalogId": "clx..." },
  "columns": [ /* ColumnListItem[] */ ],
  "products": [
    {
      "id": "clx...",
      "primaryCode": "6205",
      "description": "Ruleman 6205",
      "dynamicData": { "marca": "SKF" },
      "createdAt": "2026-06-19T12:00:00.000Z",
      "updatedAt": "2026-06-19T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 120, "totalPages": 3 }
}
```

`CONSULTA`: `dynamicData` excluye claves de columnas ocultas.

→ `src/features/catalog/schemas/product.schemas.ts`

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
| `setFolderSearchConfigAction` | `{ folderId, config: FolderColumnKeysConfig \| null }` | `FolderListItem` | Motor búsqueda: Fase 7 |
| `setFolderFilterConfigAction` | `{ folderId, config: FolderColumnKeysConfig \| null }` | `FolderListItem` | Motor filtros: Fase 7 |

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

**`ColumnListItem`:** metadatos completos — `id`, `folderId`, `originalName`, `displayName`, `internalKey`, `dataType`, `order`, `visibleToNormalUser`, flags (`isSearchable`, `isFilterable`, `isPrimaryCode`, `isDescription`, `isImageCode`, …), `globalFieldKey`, `width`, `format`, `unit`, `label`, timestamps.

**Errores:** `FOLDER_NOT_FOUND`, `COLUMN_DUPLICATE_KEY`, `COLUMN_PRIMARY_CODE_CONFLICT`, `VALIDATION_ERROR`, `FORBIDDEN`.

Campos opcionales de create/update: ver `src/features/catalog/schemas/column.schemas.ts`.

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
| `/admin/archivos` | Placeholder | Excel e importaciones (Fase 4+) |
| `/admin/users` | ❌ | Gestión usuarios |

---

## Auditoría (interno)

Sin endpoint de consulta. Eventos en `AuditLog`: login/logout, CRUD usuarios, CRUD/vaciado catálogos, `FILE_UPLOADED` (con `auditContext`). Fallos de auditoría no interrumpen la operación.

---

## Pendiente (sin contrato aún)

Importador Excel, CRUD manual de productos, búsqueda/filtros, archivos subidos, offline/sync. Detalle por fase: [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md).

---

## Referencias rápidas

| Área | Archivos |
|------|----------|
| Auth | `src/features/auth/actions/`, `src/features/auth/schemas/auth.schemas.ts`, `src/server/auth/config.ts` |
| Usuarios | `src/features/users/actions/user.actions.ts`, `schemas/user.schemas.ts` |
| Catálogos | `src/features/catalog/actions/catalog.actions.ts`, `schemas/catalog.schemas.ts`, `types/catalog.types.ts` |
| Carpetas | `folder.actions.ts`, `schemas/folder.schemas.ts`, `types/folder.types.ts` |
| Columnas | `column.actions.ts`, `schemas/column.schemas.ts`, `types/column.types.ts` |
| REST productos / navegación | `src/app/api/admin/folders/[folderId]/products/route.ts`, `.../catalogs/[catalogId]/navigation/route.ts` |
| Directorio | `src/app/api/admin/directory/route.ts`, `src/features/directory/types/directory.types.ts` |
| UI catálogos (mock) | `src/features/catalog/components/CatalogNavigator.tsx`, `data/mockCatalogNavigator.data.ts` |
