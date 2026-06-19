# ENDPOINTS — Referencia para frontend

> Documento derivado de las tareas **completadas** en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) (Fase 2: base del sistema), alineado con la integración frontend del PR #3.  
> Última actualización: 2026-06-19.

---

## Tabla de contenidos

- [Convenciones generales](#convenciones-generales)
- [Autenticación y sesión](#autenticación-y-sesión)
- [Gestión de usuarios (panel admin)](#gestión-de-usuarios-panel-admin)
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
| `role` | `ADMIN` \| `CONSULTA` |
| `status` | `ACTIVE` \| `INACTIVE` |

---

## Autenticación y sesión

**Fase:** 2.3 Autenticación (RF-001)  
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

> El frontend debe escuchar `signal === "grg:offline:clear"` para limpiar IndexedDB cuando exista el modo offline (Fase 9). Con `logoutFormAction` la respuesta no llega al cliente porque hay redirección inmediata.

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

**Fase:** 2.4 Usuarios (RF-002)  
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

## Directorio de catálogos

**Fase:** 2.5 Directorio (RF-004)  
**Uso en frontend:** API disponible; **aún no consumida** en UI. La vista de catálogos (`/admin/catalogos`) es placeholder. Integración prevista en Fase 3.

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
| `sectionCount` | Cantidad de secciones; `0` hasta Fase 3 (`CatalogSection`) |
| `offlineSync.status` | Placeholder `"unavailable"` hasta Fase 9 (modo offline) |
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

> Solo se incluyen catálogos con `status = ACTIVE`, ordenados por `order` ascendente. Nuevos catálogos activos aparecen automáticamente sin cambios de código.

---

## Auditoría (backend interno)

**Fase:** 2.6 Auditoría (RNF §38.2)

No hay endpoint REST de consulta de logs en esta fase. El backend registra operaciones importantes en la tabla `AuditLog` de forma interna.

**Eventos registrados actualmente:**

| Acción | Cuándo |
|--------|--------|
| `USER_LOGIN` | Inicio de sesión exitoso |
| `USER_LOGOUT` | Cierre de sesión |
| `USER_CREATED` / `USER_UPDATED` / `USER_ACTIVATED` / `USER_DEACTIVATED` | Gestión de usuarios (ADMIN) |
| `FILE_UPLOADED` | Subida vía `uploadFile()` cuando se pasa `auditContext: { userId }` |

Los fallos al escribir en `AuditLog` no interrumpen la operación principal.

---

## Rutas de la aplicación (no API)

Rutas relevantes para el frontend; no exponen JSON pero definen la navegación.

### Sitio público

| Ruta | Acceso | Estado | Uso |
|------|--------|--------|-----|
| `/` | Pública | Implementada | Landing de Rothamel Repuestos (hero, marcas, contacto, mapa) |
| `/login` | Pública | Implementada | Alias: redirección server-side a `/auth/login` |

### Autenticación

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

### Panel admin (protegido)

Navegación lateral definida en `src/features/admin/data/adminNav.ts`. Tras login, destino por defecto: `/admin`.

| Ruta | Acceso | Estado | Uso |
|------|--------|--------|-----|
| `/admin` | Protegida | Placeholder | Home del panel (`AdminPlaceholder`) |
| `/admin/catalogos` | Protegida | Placeholder | Sección "Catálogos" (nav) — futura integración con directorio / Fase 3 |
| `/admin/archivos` | Protegida | Placeholder | Sección "Archivos" (nav) — futura Fase 8 |
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

**Constantes de rutas en código**

| Constante | Valor | Archivo |
|-----------|-------|---------|
| `LOGIN_PATH` (landing) | `/auth/login` | `src/features/landing/data/landingData.ts` |
| `AUTH_LOGIN_PATH` | `/auth/login` | `src/server/auth/config.ts` |
| `ADMIN_USER_EMAIL_FALLBACK` | `admin@rothamelrepuestos.com.ar` | `src/features/admin/data/adminNav.ts` |

---

## Pendiente de implementación

Las siguientes áreas están documentadas en el plan backend pero **aún no tienen endpoints** disponibles para el frontend:

| Área | Fase | Referencia |
|------|------|------------|
| Catálogos y secciones | 3 | CRUD, columnas dinámicas, registros paginados |
| Importador Excel | 4 | Upload multipart, análisis, publicación |
| Imágenes de producto | 5 | Extracción, asociación, URLs firmadas |
| Administración manual | 6 | CRUD de registros y equivalencias |
| Búsqueda y filtros | 7 | Búsqueda por sección, catálogo y global |
| Archivos subidos | 8 | Historial, descarga, reimportación |
| Sincronización offline | 9 | Manifiestos, deltas, versionado |

Cuando se implementen nuevas fases, este documento debe ampliarse con las secciones correspondientes.

---

## Referencias

- Plan backend: [`docs/BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md)
- Schemas de validación auth: [`src/features/auth/schemas/auth.schemas.ts`](../src/features/auth/schemas/auth.schemas.ts)
- Schemas de validación usuarios: [`src/features/users/schemas/user.schemas.ts`](../src/features/users/schemas/user.schemas.ts)
- Tipos del directorio: [`src/features/directory/types/directory.types.ts`](../src/features/directory/types/directory.types.ts)
- Navegación del panel: [`src/features/admin/data/adminNav.ts`](../src/features/admin/data/adminNav.ts)
- Login (formulario): [`src/features/auth/actions/login-form.action.ts`](../src/features/auth/actions/login-form.action.ts)
- Logout (formulario): [`src/features/auth/actions/logout-form.action.ts`](../src/features/auth/actions/logout-form.action.ts)
- Configuración de rutas protegidas: [`src/server/auth/config.ts`](../src/server/auth/config.ts)
