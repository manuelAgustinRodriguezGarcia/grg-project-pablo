# ENDPOINTS — Referencia para frontend

> Documento derivado de las tareas **completadas** en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) (Fase 2: base del sistema).  
> Última actualización: 2026-06-18.

---

## Tabla de contenidos

- [Convenciones generales](#convenciones-generales)
- [Autenticación y sesión](#autenticación-y-sesión)
- [Gestión de usuarios (panel admin)](#gestión-de-usuarios-panel-admin)
- [Directorio de catálogos](#directorio-de-catálogos)
- [Auditoría (backend interno)](#auditoría-backend-interno)
- [Rutas de la aplicación (no API)](#rutas-de-la-aplicación-no-api)
- [Pendiente de implementación](#pendiente-de-implementación)

---

## Convenciones generales

### Tipos de integración

| Tipo | Cuándo usarlo | Ubicación en código |
|------|---------------|---------------------|
| **Route Handler (REST)** | Consultas desde cliente con `fetch`, hooks de datos, verificación de sesión | `src/app/api/**/route.ts` |
| **Server Action** | Formularios y mutaciones desde componentes React del panel admin | `src/features/**/actions/*.ts` |
| **Callback de auth** | Flujo OAuth / enlace de recuperación de contraseña (redirección) | `src/app/auth/callback/route.ts` |

### Autenticación

- La sesión se gestiona con **cookies de Supabase** (`@supabase/ssr`). No hace falta enviar tokens manualmente en las peticiones del mismo origen.
- Rutas bajo `/admin` y `/api/admin` están **protegidas por middleware**. Sin sesión válida:
  - Páginas → redirección a `/auth/login?redirectTo=...`
  - APIs → `401 { "error": "No autenticado" }`
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
| **Uso típico** | Formulario en `/auth/login` |

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

### Server Action: `signOutAction`

Cierra la sesión actual.

| | |
|---|---|
| **Import** | `@/features/auth/actions/auth.actions` |
| **Auth** | Sesión válida |
| **Uso típico** | Botón "Cerrar sesión" en el panel |

**Entrada:** ninguna

**Respuesta 200 (éxito)**

```ts
{
  success: true,
  data: {
    clearOfflineData: true,
    signal: "grg:offline:clear"
  }
}
```

> El frontend debe escuchar `signal === "grg:offline:clear"` para limpiar IndexedDB cuando exista el modo offline (Fase 9).

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
**Uso en frontend:** pantalla de administración de usuarios (`/admin/users` o equivalente). Solo rol `ADMIN`.

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
**Uso en frontend:** pantalla principal post-login (`/admin`) con tarjetas de catálogos activos.

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

| Ruta | Acceso | Uso |
|------|--------|-----|
| `/auth/login` | Pública | Inicio de sesión |
| `/auth/forgot-password` | Pública | Solicitar recuperación |
| `/auth/reset-password` | Pública (tras callback) | Nueva contraseña |
| `/auth/callback` | Pública | Callback Supabase |
| `/admin/*` | Protegida | Panel privado |
| `/api/admin/*` | Protegida | APIs REST del panel |

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
- Configuración de rutas protegidas: [`src/server/auth/config.ts`](../src/server/auth/config.ts)
