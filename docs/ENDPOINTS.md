# ENDPOINTS — Referencia para frontend

> Documento derivado de las tareas **completadas** en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) (Fases 2–3.2), alineado con [`PRD.md`](./PRD.md) y la integración frontend del PR #3.  
> Última actualización: 2026-06-19.

---

## Tabla de contenidos

- [Convenciones generales](#convenciones-generales)
- [Alineación con el PRD](#alineación-con-el-prd)
- [Autenticación y sesión](#autenticación-y-sesión)
- [Gestión de usuarios (panel admin)](#gestión-de-usuarios-panel-admin)
- [Gestión de catálogos (panel admin)](#gestión-de-catálogos-panel-admin)
- [Directorio de catálogos](#directorio-de-catálogos)
- [Auditoría (backend interno)](#auditoría-backend-interno)
- [Rutas de la aplicación (no API)](#rutas-de-la-aplicación-no-api)
- [Estado de integración frontend](#estado-de-integración-frontend)
- [Pendiente de implementación](#pendiente-de-implementación)

---

## Convenciones generales

### Tipos de integración

| Tipo | Cuándo usarlo | Ubicación en código |
|------|---------------|---------------------|
| **Route Handler (REST)** | Consultas desde cliente con `fetch`, hooks de datos, verificación de sesión | `src/app/api/**/route.ts` |
| **Server Action** | Formularios y mutaciones desde componentes React del panel admin | `src/features/**/actions/*.ts` |
| **Server Action (formulario)** | Login y logout con `<form action={...}>` y `useActionState` | `login-form.action.ts`, `logout-form.action.ts` |
| **Callback de auth** | Flujo OAuth / enlace de recuperación de contraseña (redirección) | `src/app/auth/callback/route.ts` |

### Autenticación

- La sesión se gestiona con **cookies de Supabase** (`@supabase/ssr`). No hace falta enviar tokens manualmente en las peticiones del mismo origen.
- Rutas bajo `/admin` y `/api/admin` están **protegidas por middleware**. Sin sesión válida:
  - Páginas → redirección a `/auth/login?redirectTo=<ruta-original>`
  - APIs → `401 { "error": "No autenticado" }`
- Usuario ya autenticado que visita `/auth/login` → redirección a `redirectTo` (query) o `/admin` por defecto.
- El layout de admin (`src/app/admin/layout.tsx`) además valida sesión con `requireAuthOrRedirect("/admin")` en el servidor.
- Roles: `ADMIN` | `CONSULTA`. Las acciones de usuarios exigen rol `ADMIN`.
- **Usuario normal (PRD §8.3):** corresponde al rol `CONSULTA`. Solo lectura de catálogos, carpetas y productos **visibles**; sin controles de edición.

### Formato de respuesta (Server Actions)

Todas las Server Actions devuelven un resultado discriminado:

```ts
// Éxito
{ success: true, data: T }

// Error
{ success: false, error: string, code?: string }
```

> **Importante:** `signInAction` redirige con `redirect()` en caso de éxito; no devuelve `{ success: true }`. En error sí devuelve el objeto anterior.

### Enums compartidos

| Campo | Valores |
|-------|---------|
| `role` | `ADMIN` \| `CONSULTA` (PRD: `ADMIN` \| `USER`) |
| `status` | `ACTIVE` \| `INACTIVE` |

### Dominio de producción (RF-004, PRD §1)

```text
www.rothamelrepuestos.com.ar
```

Variable relevante: `NEXT_PUBLIC_APP_URL` (enlaces de recuperación de contraseña y callbacks).

---

## Alineación con el PRD

### Glosario producto ↔ API

| PRD (UI / producto) | Backend / respuestas JSON | Notas |
|---------------------|---------------------------|-------|
| Carpeta | `CatalogFolder` | Subdivisión de un catálogo; generalmente una hoja Excel. Modelo Prisma Fase 3.1 |
| Producto | `Product` | Fila de datos dentro de una carpeta. Modelo Prisma Fase 3.1 |
| Usuario normal | Rol `CONSULTA` | El PRD usa `USER`; el enum en código es `CONSULTA` |
| Sección (doc. anterior) | **Carpeta** | Nomenclatura deprecada en documentación |

### Modelo de tres niveles (PRD §7)

```text
Catálogo → Carpeta → Producto
```

**Estado del modelo de datos (Fase 3.1):** tablas Prisma `Catalog`, `CatalogFolder`, `FolderColumn` y `Product` implementadas con relaciones en cascada y campos `visibleToNormalUser` en catálogo, carpeta y columna.

**Estado de gestión admin (Fase 3.2):** CRUD de catálogos vía Server Actions (solo `ADMIN`). Carpetas, productos, navegación y filtrado de visibilidad en lecturas GET siguen pendientes (3.3–3.8).

El panel privado (PRD §12) navega con sidebar:

```text
Catálogos   → consulta y gestión de catálogos, carpetas y productos
Archivos    → archivos Excel subidos, historial e informes de importación
```

### Visibilidad por rol (PRD §9) — impacto en APIs

Los modelos Prisma ya incluyen `visibleToNormalUser` en `Catalog`, `CatalogFolder` y `FolderColumn` (Fase 3.1). Cuando se implemente `VisibilityService` (3.7), las respuestas para rol `CONSULTA` **excluirán** entidades y columnas marcadas como no visibles. El rol `ADMIN` siempre recibe todo. Esto aplica a directorio, listados, búsqueda y sync offline.

---

## Autenticación y sesión

**Fase backend:** 2.3 · **RF:** RF-001 (PRD §11)  
**Uso en frontend:** pantallas de login, recuperación de contraseña, layout del panel, verificación de sesión al cargar la app.

### `GET /api/admin/session`

Obtiene el perfil del usuario autenticado. Útil para hidratar el estado de sesión en el cliente sin invocar una Server Action.

| | |
|---|---|
| **Auth** | Sesión válida (cookie) |
| **Rol mínimo** | Cualquier usuario autenticado y activo |

**Respuesta 200**

```json
{
  "id": "uuid",
  "email": "usuario@ejemplo.com",
  "name": "Nombre",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

**Respuesta 401**

```json
{ "error": "No autenticado" }
```

**Ejemplo (cliente)**

```ts
const res = await fetch("/api/admin/session");
if (res.ok) {
  const session = await res.json();
}
```

**Implementación:** `src/app/api/admin/session/route.ts`

---

### `GET /auth/callback`

Intercambia el `code` de Supabase por una sesión (recuperación de contraseña u OAuth). **No se llama con `fetch`**; es la URL de destino del enlace del correo de Supabase.

| Query param | Descripción |
|-------------|-------------|
| `code` | Código de autorización (obligatorio) |
| `next` | Ruta de destino tras éxito. Por defecto `/admin`. Usar `/auth/reset-password` para el flujo de nueva contraseña |

**Comportamiento**

| Caso | Resultado |
|------|-----------|
| Sin `code` | Redirección a `/auth/login` |
| Error al intercambiar código | Redirección a `/auth/login?error=auth_callback_failed` |
| Éxito | Redirección a `next` (o `/admin`) |

**Implementación:** `src/app/auth/callback/route.ts`

---

### Server Action: `signInAction`

Inicio de sesión con correo y contraseña.

| | |
|---|---|
| **Import** | `@/features/auth/actions/auth.actions` |
| **Auth** | Pública |
| **Uso típico** | Invocación directa; en UI se usa `loginFormAction` (ver abajo) |

**Entrada**

```ts
{
  email: string;    // correo válido
  password: string; // mín. 8 caracteres
}
```

**Segundo argumento opcional:** `redirectTo` (string, default `"/admin"`)

**Respuesta**

| Caso | Resultado |
|------|-----------|
| Éxito | Redirección server-side a `redirectTo` |
| Credenciales inválidas | `{ success: false, error: "...", code: "INVALID_CREDENTIALS" }` |
| Usuario desactivado | `{ success: false, error: "...", code: "USER_INACTIVE" }` |
| Validación | `{ success: false, error: "..." }` |

**Códigos de error (`code`)**

| Código | Significado |
|--------|-------------|
| `INVALID_CREDENTIALS` | Email o contraseña incorrectos |
| `USER_INACTIVE` | Cuenta desactivada |
| `AUTH_PROVIDER_ERROR` | Error del proveedor Supabase |

---

### Server Action: `loginFormAction`

Wrapper de `signInAction` para formularios con `useActionState` y campos `FormData`.

| | |
|---|---|
| **Import** | `@/features/auth/actions/login-form.action` |
| **Auth** | Pública |
| **Uso en frontend** | `LoginFormCard` en `/auth/login` |

**Campos del formulario (`FormData`)**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `email` | string | Correo del usuario |
| `password` | string | Contraseña |
| `redirectTo` | string (opcional) | Ruta interna tras login; default `/admin`. Solo rutas que empiezan con `/` y no con `//` |

**Respuesta**

| Caso | Resultado |
|------|-----------|
| Éxito | Redirección server-side (igual que `signInAction`); el cliente no recibe `{ success: true }` |
| Error | `{ success: false, error: string, code?: string }` — mostrado en `LoginFormCard` |

**Implementación:** `src/features/auth/components/LoginFormCard.tsx`

---

### Server Action: `signOutAction`

Cierra la sesión actual.

| | |
|---|---|
| **Import** | `@/features/auth/actions/auth.actions` |
| **Auth** | Sesión válida |
| **Uso típico** | Lógica de cierre de sesión; en UI se usa `logoutFormAction` (ver abajo) |

**Entrada:** ninguna

**Respuesta (éxito)**

```ts
{
  success: true,
  data: {
    clearOfflineData: true,
    signal: "grg:offline:clear"
  }
}
```

> El frontend debe escuchar `signal === "grg:offline:clear"` para limpiar IndexedDB cuando exista el modo offline (PRD §38, Fase backend 9). Con `logoutFormAction` la respuesta no llega al cliente porque hay redirección inmediata.

---

### Server Action: `logoutFormAction`

Cierra sesión y redirige al login. Usado desde `<form action={logoutFormAction}>`.

| | |
|---|---|
| **Import** | `@/features/auth/actions/logout-form.action` |
| **Auth** | Sesión válida |
| **Uso en frontend** | `AdminSignOutButton` en el sidebar del panel |

**Entrada:** ninguna (acción de formulario sin campos)

**Comportamiento**

| Caso | Resultado |
|------|-----------|
| Éxito | Redirección a `/auth/login` |
| Error al cerrar sesión | Redirección a `/auth/login?error=logout_failed` |

**Implementación:** `src/features/auth/components/AdminSignOutButton.tsx`

---

### Server Action: `requestPasswordResetAction`

Envía el correo de recuperación de contraseña.

| | |
|---|---|
| **Import** | `@/features/auth/actions/auth.actions` |
| **Auth** | Pública |
| **Uso típico** | Formulario en `/auth/forgot-password` |

**Entrada**

```ts
{ email: string }
```

**Respuesta**

```ts
// Éxito
{ success: true, data: undefined }

// Error
{ success: false, error: string, code?: string }
```

---

### Server Action: `updatePasswordAction`

Establece una nueva contraseña (usuario ya autenticado tras el callback).

| | |
|---|---|
| **Import** | `@/features/auth/actions/auth.actions` |
| **Auth** | Sesión válida (tras `/auth/callback`) |
| **Uso típico** | Formulario en `/auth/reset-password` |

**Entrada**

```ts
{
  password: string;        // 8–72 caracteres
  confirmPassword: string; // debe coincidir con password
}
```

**Respuesta**

```ts
{ success: true, data: undefined }
// o
{ success: false, error: string, code?: string }
```

---

### Cliente Supabase en el navegador (opcional)

Para escuchar cambios de sesión en tiempo real en componentes cliente:

```ts
import { createSupabaseBrowserClient } from "@/server/auth/supabase-browser";

const supabase = createSupabaseBrowserClient();
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  // actualizar UI
});
```

---

## Gestión de usuarios (panel admin)

**Fase backend:** 2.4 · **RF:** RF-002 (PRD §8)  
**Uso en frontend:** pantalla de administración de usuarios (`/admin/users`). Solo rol `ADMIN`. **UI pendiente** — las Server Actions están listas para integrar.

Todas las acciones importan desde `@/features/users/actions/user.actions`.

### Server Action: `listUsersAction`

Lista todos los usuarios del sistema.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |
| **Entrada** | ninguna |

**Respuesta (éxito)**

```ts
{
  success: true,
  data: Array<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "CONSULTA";
    status: "ACTIVE" | "INACTIVE";
    lastAccessAt: string | null;  // ISO date
    createdAt: string;            // ISO date
  }>
}
```

---

### Server Action: `createUserAction`

Crea un usuario en Supabase Auth y en la tabla local `User`.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{
  email: string;
  password: string;  // 8–72 caracteres
  name: string;      // 1–120 caracteres
  role: "ADMIN" | "CONSULTA";
}
```

**Respuesta (éxito):** `{ success: true, data: UserListItem }`

**Códigos de error**

| Código | Significado |
|--------|-------------|
| `EMAIL_ALREADY_EXISTS` | El correo ya está registrado |
| `VALIDATION_ERROR` | Datos de entrada inválidos |
| `FORBIDDEN` | El solicitante no es ADMIN |

---

### Server Action: `updateUserAction`

Edita nombre y/o rol de un usuario.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{
  id: string;              // UUID del usuario
  name?: string;           // 1–120 caracteres
  role?: "ADMIN" | "CONSULTA";
  // Al menos uno de name o role es obligatorio
}
```

**Respuesta (éxito):** `{ success: true, data: UserListItem }`

**Códigos de error:** `USER_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`

---

### Server Action: `activateUserAction`

Reactiva un usuario desactivado.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ userId: string }  // UUID
```

**Respuesta (éxito):** `{ success: true, data: UserListItem }`

---

### Server Action: `deactivateUserAction`

Desactiva un usuario y cierra todas sus sesiones activas en Supabase.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ userId: string }  // UUID
```

**Respuesta (éxito):** `{ success: true, data: UserListItem }`

**Códigos de error**

| Código | Significado |
|--------|-------------|
| `CANNOT_DEACTIVATE_SELF` | Un admin no puede desactivar su propia cuenta |
| `USER_NOT_FOUND` | Usuario inexistente |

---

## Gestión de catálogos (panel admin)

**Fase backend:** 3.2 · **RF:** RF-006, RF-010 (PRD §14.1–§14.3)  
**Uso en frontend:** pantalla de catálogos (`/admin/catalogos`). Solo rol `ADMIN`. **UI pendiente** — las Server Actions están listas para integrar.

Todas las acciones importan desde `@/features/catalog/actions/catalog.actions`.

### Tipo de respuesta común

```ts
type CatalogActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

### Tipo `CatalogListItem`

```ts
{
  id: string;
  name: string;
  description: string | null;
  coverImagePath: string | null;
  status: "ACTIVE" | "INACTIVE" | "HIDDEN";
  order: number;
  visibleToNormalUser: boolean;
  folderCount: number;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```

### Server Action: `listCatalogsAction`

Lista todos los catálogos (cualquier `status`), ordenados por `order`.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |
| **Entrada** | ninguna |

**Respuesta (éxito):** `{ success: true, data: CatalogListItem[] }`

---

### Server Action: `createCatalogAction`

Crea un catálogo. Si no se indica `order`, se asigna el siguiente disponible.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{
  name: string;                    // 1–200 caracteres
  description?: string | null;     // máx. 2000
  status?: "ACTIVE" | "INACTIVE" | "HIDDEN";
  order?: number;                  // entero ≥ 0
  visibleToNormalUser?: boolean;   // default true
}
```

**Respuesta (éxito):** `{ success: true, data: CatalogListItem }`

**Códigos de error:** `VALIDATION_ERROR`, `INVALID_STATUS`, `FORBIDDEN`

---

### Server Action: `updateCatalogAction`

Edita nombre, descripción y/o estado.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{
  id: string;                      // cuid del catálogo
  name?: string;
  description?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "HIDDEN";
  // Al menos uno de name, description o status es obligatorio
}
```

**Respuesta (éxito):** `{ success: true, data: CatalogListItem }`

**Códigos de error:** `CATALOG_NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATUS`, `FORBIDDEN`

---

### Server Action: `reorderCatalogsAction`

Actualiza el orden de uno o más catálogos.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{
  items: Array<{ id: string; order: number }>;  // mínimo 1 ítem
}
```

**Respuesta (éxito):** `{ success: true, data: CatalogListItem[] }` (lista completa reordenada)

---

### Server Action: `setCatalogVisibilityAction`

Oculta o muestra el catálogo para usuarios con rol `CONSULTA` (`visibleToNormalUser`). El filtrado en `GET /api/admin/directory` para `CONSULTA` se implementará en Fase 3.7.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ catalogId: string; visible: boolean }
```

**Respuesta (éxito):** `{ success: true, data: CatalogListItem }`

---

### Server Action: `deleteCatalogAction`

Elimina el catálogo y en cascada sus carpetas, columnas y productos. **No** elimina archivos Excel originales (modelo `UploadedFile` pendiente en Fase 4). Elimina la imagen de portada del bucket `product-images` si existe.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ catalogId: string }
```

**Respuesta (éxito):** `{ success: true, data: undefined }`

**Códigos de error:** `CATALOG_NOT_FOUND`, `FORBIDDEN`

> La UI debe mostrar modal de confirmación antes de invocar esta acción (PRD §14.2).

---

### Server Action: `clearCatalogAction`

Elimina todos los productos de las carpetas del catálogo. Conserva catálogo, carpetas, columnas y visibilidad (PRD §14.3).

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ catalogId: string }
```

**Respuesta (éxito)**

```ts
{ success: true, data: { deletedProductCount: number } }
```

> La UI debe mostrar modal de confirmación antes de invocar esta acción (PRD §14.3).

---

### Server Action: `setCoverImageAction`

Sube imagen representativa al bucket `product-images` y actualiza `coverImagePath`. Formatos permitidos: `.jpg`, `.jpeg`, `.png`, `.webp`.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada:** `FormData` con campos `catalogId` (string) y `file` (File).

**Respuesta (éxito):** `{ success: true, data: CatalogListItem }`

---

### Server Action: `removeCoverImageAction`

Elimina la imagen de portada del Storage y pone `coverImagePath` en `null`.

| | |
|---|---|
| **Auth** | Sesión + rol `ADMIN` |

**Entrada**

```ts
{ catalogId: string }
```

**Respuesta (éxito):** `{ success: true, data: CatalogListItem }`

---

### Códigos de error compartidos

| Código | Significado |
|--------|-------------|
| `CATALOG_NOT_FOUND` | Catálogo inexistente |
| `VALIDATION_ERROR` | Datos de entrada inválidos o archivo de imagen rechazado |
| `INVALID_STATUS` | Estado de catálogo no permitido |
| `FORBIDDEN` | El solicitante no es ADMIN |
| `UNAUTHENTICATED` | Sin sesión válida |

**Schemas Zod:** `src/features/catalog/schemas/catalog.schemas.ts`  
**Tipos:** `src/features/catalog/types/catalog.types.ts`

---

## Directorio de catálogos

**Fase backend:** 2.5 · **PRD:** §7 (directorio automático), §13 (navegación)  
**Uso en frontend:** API disponible; **aún no consumida** en UI. La vista de catálogos (`/admin/catalogos`) es placeholder. Para CRUD admin ver [Gestión de catálogos](#gestión-de-catálogos-panel-admin).

Reemplaza las hojas índice manuales de Excel (ej. Catálogo Azul): el sistema genera el directorio desde catálogos activos sin mantener una carátula manual.

### `GET /api/admin/directory`

Lista automáticamente los catálogos activos del directorio privado con metadatos para tarjetas.

| | |
|---|---|
| **Auth** | Sesión válida (cookie) |
| **Rol mínimo** | Cualquier usuario autenticado y activo (`ADMIN` o `CONSULTA`) |

**Respuesta 200**

```json
{
  "catalogs": [
    {
      "id": "clx...",
      "name": "Rulemanes",
      "description": "Catálogo de rulemanes",
      "coverImageUrl": "https://...signed...",
      "sectionCount": 0,
      "updatedAt": "2026-06-18T12:00:00.000Z",
      "order": 0,
      "offlineSync": {
        "status": "unavailable"
      }
    }
  ],
  "generatedAt": "2026-06-18T12:00:00.000Z"
}
```

| Campo | Descripción |
|-------|-------------|
| `coverImageUrl` | URL firmada temporal si el catálogo tiene `coverImagePath` en bucket `product-images`; `null` si no hay imagen o falla la firma |
| `sectionCount` | **Nombre legacy en API.** Cantidad de **carpetas** del catálogo; `0` hasta implementar conteo en `DirectoryService` (Fase 3.8). En UI mostrar como carpetas, no como “secciones” |
| `offlineSync.status` | Placeholder `"unavailable"` hasta Fase backend 9 (PRD §38) |
| `generatedAt` | Momento en que se generó el directorio en el servidor |

**Respuesta 401**

```json
{ "error": "No autenticado" }
```

**Ejemplo (cliente)**

```ts
const res = await fetch("/api/admin/directory");
if (res.ok) {
  const { catalogs, generatedAt } = await res.json();
}
```

**Implementación:** `src/app/api/admin/directory/route.ts`  
**Tipos:** `src/features/directory/types/directory.types.ts`

> Solo se incluyen catálogos con `status = ACTIVE`, ordenados por `order` ascendente. Nuevos catálogos activos creados con `createCatalogAction` aparecen automáticamente sin cambios de código (PRD §50).

**Evolución Fase 3:** el filtrado por `visibleToNormalUser` para rol `CONSULTA` se implementará en 3.7 (`VisibilityService`). `sectionCount` reflejará carpetas visibles en 3.8.

---

## Auditoría (backend interno)

**Fase backend:** 2.6 · **RNF:** PRD §41.2 (seguridad)

No hay endpoint REST de consulta de logs en esta fase. El backend registra operaciones importantes en la tabla `AuditLog` de forma interna.

**Eventos registrados actualmente:**

| Acción | Cuándo |
|--------|--------|
| `USER_LOGIN` | Inicio de sesión exitoso |
| `USER_LOGOUT` | Cierre de sesión |
| `USER_CREATED` / `USER_UPDATED` / `USER_ACTIVATED` / `USER_DEACTIVATED` | Gestión de usuarios (ADMIN) |
| `CATALOG_CREATED` / `CATALOG_UPDATED` / `CATALOG_DELETED` / `CATALOG_CLEARED` | Gestión de catálogos (ADMIN, Fase 3.2) |
| `FILE_UPLOADED` | Subida vía `uploadFile()` cuando se pasa `auditContext: { userId }` |

**Reservados (Fase 3+):** `FOLDER_*`, `IMPORT_PUBLISHED`, etc.

Los fallos al escribir en `AuditLog` no interrumpen la operación principal.

---

## Rutas de la aplicación (no API)

Rutas relevantes para el frontend; no exponen JSON pero definen la navegación.

### Sitio público (PRD §10, RF-003)

| Ruta | Acceso | Estado | Uso |
|------|--------|--------|-----|
| `/` | Pública | Implementada | Landing de Rothamel Repuestos (hero, marcas, contacto, mapa). Sin información de catálogos privados |
| `/login` | Pública | Implementada | Alias: redirección server-side a `/auth/login` |

Dominio de producción: `www.rothamelrepuestos.com.ar` (RF-004).

### Autenticación (PRD §11)

| Ruta | Acceso | Estado | Uso |
|------|--------|--------|-----|
| `/auth/login` | Pública | Implementada | Login (`LoginFormCard` + `loginFormAction`). Query: `redirectTo` |
| `/auth/forgot-password` | Pública | Sin página | Definida en middleware; formulario pendiente |
| `/auth/reset-password` | Pública (tras callback) | Sin página | Definida en middleware; formulario pendiente |
| `/auth/callback` | Pública | Implementada | Callback Supabase (enlace de correo) |

**Query params en `/auth/login`**

| Param | Descripción |
|-------|-------------|
| `redirectTo` | Ruta interna tras login exitoso (default `/admin`). El middleware la añade al redirigir desde rutas protegidas |
| `error` | Opcional; `logout_failed` si falla `logoutFormAction`; `auth_callback_failed` si falla el callback |

### Panel admin (protegido — PRD §12)

Navegación lateral definida en `src/features/admin/data/adminNav.ts`. Tras login, destino por defecto: `/admin`.

| Ruta | Acceso | Estado | Uso |
|------|--------|--------|-----|
| `/admin` | Protegida | Placeholder | Home del panel (`AdminPlaceholder`) |
| `/admin/catalogos` | Protegida | Placeholder | **Catálogos** — Server Actions 3.2 listas; UI pendiente (PRD §13) |
| `/admin/archivos` | Protegida | Placeholder | **Archivos** — Excel subidos, historial e informes (PRD §37) |
| `/admin/users` | Protegida | Sin página | Gestión de usuarios (Server Actions existentes, UI pendiente) |

### APIs REST

| Prefijo | Acceso |
|---------|--------|
| `/api/admin/*` | Protegida (cookie de sesión) |

---

## Estado de integración frontend

Resumen tras el merge del PR #3 (landing, login y shell del panel).

| Recurso backend | Integrado en UI | Componente / ruta |
|-----------------|-----------------|-------------------|
| `loginFormAction` | Sí | `LoginFormCard` → `/auth/login` |
| `logoutFormAction` | Sí | `AdminSignOutButton` → sidebar admin |
| `requireAuthOrRedirect` | Sí | `src/app/admin/layout.tsx` |
| `GET /api/admin/session` | No | — |
| `GET /api/admin/directory` | No | — |
| `signInAction` / `signOutAction` directos | No | Usados vía wrappers de formulario |
| `requestPasswordResetAction` | No | Falta `/auth/forgot-password` |
| `updatePasswordAction` | No | Falta `/auth/reset-password` |
| Acciones de usuarios (`user.actions`) | No | Falta `/admin/users` |
| Acciones de catálogos (`catalog.actions`) | No | Falta UI en `/admin/catalogos` |

**Constantes de rutas en código**

| Constante | Valor | Archivo |
|-----------|-------|---------|
| `LOGIN_PATH` (landing) | `/auth/login` | `src/features/landing/data/landingData.ts` |
| `AUTH_LOGIN_PATH` | `/auth/login` | `src/server/auth/config.ts` |
| `ADMIN_USER_EMAIL_FALLBACK` | `admin@rothamelrepuestos.com.ar` | `src/features/admin/data/adminNav.ts` |

---

## Pendiente de implementación

Áreas documentadas en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) y [`PRD.md`](./PRD.md) **sin endpoints aún**. Cuando se implementen, ampliar este documento.

### Fase backend 3 — Catálogos y carpetas (PRD fase 2)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| ~~CRUD catálogos (crear, editar, ordenar, ocultar, borrar, **vaciar**)~~ | ~~Server Actions~~ | ✅ Fase 3.2 — ver [Gestión de catálogos](#gestión-de-catálogos-panel-admin) |
| Asociación Excel ↔ catálogo (`UploadedFile`) | Server Actions | Fase 4/8 — pendiente modelo `UploadedFile` |
| CRUD carpetas (crear, renombrar, ordenar, ocultar, borrar, **vaciar**) | Server Actions | RF-007, §14 |
| Configuración de columnas por carpeta | Server Actions | RF-042, §36 |
| Visibilidad catálogo / carpeta / columna | Server Actions + filtros en GET | RF-010–RF-012, §9 |
| Listado paginado de productos por carpeta | Route Handler | RF-005, §13 |
| Metadatos de catálogo con carpetas | Route Handler | §13 |
| Renombrar `sectionCount` → `folderCount` (opcional) | Breaking change API | Alineación terminología |

### Fase backend 4 — Importador (PRD fase 5, §17–§18)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| Upload Excel (+ ZIP / imágenes) | Route Handler multipart | RF-013, RF-014 |
| Asistente 6 pasos: destino, vista previa, combinar/reemplazar/aplicar | Server Actions | RF-015–RF-025 |
| Estados de importación y publicación segura | Interno + consulta estado | RF-044, §21 |
| Informe de importación | Route Handler | §22 |

### Fase backend 5 — Imágenes (PRD fase 6, §23–§28)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| URLs firmadas miniatura / vista ampliada | Route Handler | RF-032 |
| Revisión de imágenes pendientes / ambiguas | Server Actions + GET | RF-031, §27 |
| Asociación manual imagen ↔ producto | Server Actions | §27 |

### Fase backend 6 — Administración manual (PRD fase 3, §15)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| CRUD productos (crear, editar, eliminar, duplicar) | Server Actions | RF-008, RF-009 |
| Gestión de equivalencias | Server Actions | RF-033, §29 |
| Imágenes manuales en producto | Server Actions | §23.3 |

### Fase backend 7 — Búsqueda y filtros (PRD fase 4, §29–§36)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| Búsqueda por carpeta | Route Handler | RF-035, §31 |
| Búsqueda por catálogo | Route Handler | RF-036, §32 |
| Búsqueda global | Route Handler | RF-037, RF-038, §33 |
| Filtros acumulables por columna + pills | Route Handler / query params | RF-039–RF-041, §34 |
| Filtros globales (campos mapeados) | Route Handler | §35 |

### Fase backend 8 — Archivos subidos (PRD fase 7, §37)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| Listado de archivos con metadatos | Route Handler | RF-043 |
| Descarga de original (URL firmada) | Route Handler | RF-043 |
| Reprocesar / combinar / reemplazar desde archivo | Server Actions | §37 |

### Fase backend 9 — Offline (PRD fase 8, §38–§39)

| Recurso previsto | Tipo | RF / PRD |
|------------------|------|----------|
| Verificar actualizaciones desde última sync | Route Handler | RF-047 |
| Descargar snapshot / delta sincronizable | Route Handler | RF-045, RF-047 |
| Bloqueo de mutaciones offline | Guards server-side | RF-046 |
| Estado de sync en directorio (`offlineSync`) | Extensión `GET /api/admin/directory` | §38.3 |

---

## Referencias

- Producto: [`docs/PRD.md`](./PRD.md)
- Plan backend: [`docs/BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md)
- Schemas de validación auth: [`src/features/auth/schemas/auth.schemas.ts`](../src/features/auth/schemas/auth.schemas.ts)
- Schemas de validación usuarios: [`src/features/users/schemas/user.schemas.ts`](../src/features/users/schemas/user.schemas.ts)
- Schemas de validación catálogos: [`src/features/catalog/schemas/catalog.schemas.ts`](../src/features/catalog/schemas/catalog.schemas.ts)
- Server Actions de catálogos: [`src/features/catalog/actions/catalog.actions.ts`](../src/features/catalog/actions/catalog.actions.ts)
- Tipos de catálogos: [`src/features/catalog/types/catalog.types.ts`](../src/features/catalog/types/catalog.types.ts)
- Tipos del directorio: [`src/features/directory/types/directory.types.ts`](../src/features/directory/types/directory.types.ts)
- Navegación del panel: [`src/features/admin/data/adminNav.ts`](../src/features/admin/data/adminNav.ts)
- Login (formulario): [`src/features/auth/actions/login-form.action.ts`](../src/features/auth/actions/login-form.action.ts)
- Logout (formulario): [`src/features/auth/actions/logout-form.action.ts`](../src/features/auth/actions/logout-form.action.ts)
- Configuración de rutas protegidas: [`src/server/auth/config.ts`](../src/server/auth/config.ts)
