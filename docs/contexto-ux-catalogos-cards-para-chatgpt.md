# Contexto UX/UI — Navegación de catálogos por cards + imágenes de carpetas

**Uso de este documento:** pegarlo en ChatGPT (o similar) y pedir que, a partir de este contexto, genere un **prompt ideal** para un agente de código (Cursor/Claude/etc.) que implemente los cambios.  
**No** es un plan de desarrollo ni una spec de implementación: es mapa de requisitos ↔ zonas del repo + comportamiento actual vs deseado.

**Repo:** `grg-project-pablo` (Next.js App Router + admin de catálogos + Prisma + storage de imágenes).  
**Fecha del contexto:** 2026-09-12.

---

## Instrucción para ChatGPT (meta)

Con este archivo como única fuente de verdad de alcance:

1. Generá un **prompt ideal** en español, listo para copiar a un coding agent.
2. El prompt debe: listar cambios por pantalla/capa, citar rutas relevantes, distinguir comportamiento actual vs deseado, y marcar qué es reutilizable vs greenfield.
3. No inventes archivos fuera de los listados acá; si falta detalle técnico, pedí al agent que inspeccione esas rutas.
4. El prompt debe enfatizar: **cambios aditivos**, **sin perder ni reescribir datos** de catálogos/carpetas/productos existentes.
5. No conviertas esto en un plan de sprints; el output debe ser un prompt de implementación accionable.

---

## Resumen del pedido (producto)

Hoy `/admin/catalogos` abre directo al navegador con **dos dropdowns** (Catálogo | Carpeta) + tabla de productos. Se pide una **experiencia previa por cards** y enriquecer la lista del dropdown de carpetas con miniaturas.

### Flujo deseado (3 niveles)

```
[1] Pantalla “Encuentra tu catálogo”
      → cards de TODOS los CATALOGOS + buscador por nombre
      → click en card
[2] Pantalla carpetas del catálogo elegido
      → botón “Volver a catálogos”
      → cards de carpetas con imagen asociada
      → click en card de carpeta
[3] Pantalla actual de productos (tabla) del folder
      (el dropdown de carpetas, cuando se use, también muestra miniatura)
```

### Restricción dura

- **No alterar** catálogos ya existentes ni perder datos (nombres, productos, columnas, visibilidad, URLs profundas `?catalog=&folder=` deben seguir funcionando).
- Preferir campos **nullable aditivos** y UI nueva; no migraciones destructivas ni reescrituras masivas.

---

## Mapa rápido de áreas

| Área | Rutas principales |
|------|-------------------|
| Página catálogos | `src/app/admin/catalogos/page.tsx` |
| Orquestador UI | `src/features/catalog/components/CatalogNavigator.tsx` |
| Dropdowns Catálogo/Carpeta | `CatalogFolderSelectors.tsx`, `CustomDropdown.tsx` (`DropdownOption` / `DropdownOptionRow`) |
| Chrome / búsqueda global | `CatalogPageChrome.tsx`, `CatalogGlobalSearchDropdown.tsx` |
| Estilos | `src/features/catalog/styles/CatalogNavigator.module.scss` |
| Tipos directory | `src/features/directory/types/directory.types.ts` (`DirectoryCatalogItem.coverImageUrl`) |
| Tipos navegación | `src/features/catalog/types/navigation.types.ts` |
| Actions catálogo (incluye cover) | `src/features/catalog/actions/catalog.actions.ts` → `setCoverImageAction`, `removeCoverImageAction` |
| Actions carpeta | `src/features/catalog/actions/folder.actions.ts` (hoy rename/delete/create; **sin** imagen) |
| Services | `directory.service.ts`, `navigation.service.ts`, `catalog.service.ts`, `folder.service.ts` |
| API navigation | `src/app/api/admin/catalogs/[catalogId]/navigation/route.ts` |
| Schema | `prisma/schema.prisma` → `Catalog`, `CatalogFolder` |
| Auth UI | `src/features/auth/types/admin-ui-auth.ts` (`isAdmin` / `canEdit` si `role === "ADMIN"`) |
| Logo fallback | `public/logos/alt-logo-blue.svg` → URL pública `/logos/alt-logo-blue.svg` |
| Patrones dropzone / modal imagen | `ColumnEditModal.tsx`, `ProductFormModal.tsx`, `ProductImagePreviewModal.tsx`, `ConfirmDialog.tsx` |
| Home usuario | `USER_HOME_PATH = "/admin/catalogos"` en `src/server/auth/config.ts` |

---

## Estado actual (comportamiento real del código)

### Entrada

- Ruta única: `/admin/catalogos`.
- Query params: `catalog`, `folder` (normalizados con `firstParam`).
- SSR carga `directoryService.getDirectory()` → lista de catálogos con `coverImageUrl` (signed), `sectionCount`, etc.
- `CatalogNavigator` recibe `catalogs`, `initialCatalogId`, `initialFolderId`, `canEdit`, `isAdmin`.

### UI actual

1. Intro / búsqueda global + action cards admin (Import Excel / Agregar producto) vía `CatalogPageChrome`.
2. `CatalogFolderSelectors`: dos `CustomDropdown` (Catálogo | Carpeta).
3. Tabla de productos del folder activo (`ProductTable`).

**No existe** pantalla de cards de catálogos ni de carpetas.

### Selección / URL

- Elegir catálogo limpia folder/filtros/página y pide `GET /api/admin/catalogs/:id/navigation`.
- Elegir carpeta carga productos.
- La URL se sincroniza con `?catalog=&folder=` (deep links desde dashboard, archivos, etc.).
- Si no hay `catalog` válido, hoy tiende a caer en el **primer catálogo** por nombre — esto **choca** con la idea de una pantalla previa de “elegí tu catálogo” cuando no hay selección explícita.

### Admin vs USUARIO

| Acción | ADMIN | USUARIO |
|--------|-------|---------|
| Edit/delete catálogo en dropdown | Sí (Pencil/Trash2) | No |
| Edit/delete carpeta en dropdown | Sí | No |
| Crear catálogo / carpeta | Sí | No |
| Import / add product | Sí | No |
| Ver catálogos/carpetas/productos | Sí | Sí (filtrado por visibilidad) |

Los handlers de edit/delete de catálogo/carpeta viven en `CatalogNavigator` y se pasan a los dropdowns como `onOptionEdit` / `onOptionDelete`. Abren `ConfirmDialog` de **rename / confirm delete** (solo nombre; **sin** UI de imagen).

### `DropdownOption` / `DropdownOptionRow` (zona del DOM Path del pedido)

Tipo actual:

```ts
type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  badge?: DropdownOptionBadge;
};
```

**No hay campo de imagen.**  
`CatalogFolderSelectors` mapea carpetas a `{ id, label: name, meta: "N productos" }` sin thumbnail.

El DOM Path citado apunta a una opción del dropdown de **carpetas**:

- Contenedor: `.dropdownOption` / `.dropdownOptionSelected` (`li[role=option]`).
- Texto: `.dropdownOptionContent` (ej. `R01-COMPRESORES` + meta `55 productos`).
- Alto típico de fila ~38–63px (padding + label + meta).
- Acciones edit/delete admin: `.dropdownOptionActions` (aparecen en hover/focus).

### Imágenes: qué hay y qué no

| Entidad | Campo DB | URL en API/UI | UI de cambio |
|---------|----------|---------------|--------------|
| **Catalog** | `coverImagePath String?` ✅ | `coverImageUrl` en directory + navigation ✅ | Actions `setCoverImage` / `removeCoverImage` existen, **no usadas** en el navigator |
| **CatalogFolder** | **Sin** campo de imagen ❌ | Navigation folders **sin** image URL ❌ | No existe |

Detalle importante: al crear/actualizar catálogo de forma optimista en el navigator, `toDirectoryCatalogItem()` hardcodea `coverImageUrl: null`, así que aunque el directory SSR traiga covers, el UI del navigator **no las muestra** hoy.

Storage de cover de catálogo (referencia): bucket `PRODUCT_IMAGES`, path tipo `catalogs/{catalogId}/cover-{uuid}` vía `catalog.service.setCoverImage` (`requireAdmin()`).

### Teclado actual (relevante)

- Búsqueda global: Esc / ↑↓ / Enter sobre resultados.
- Dropdown: Enter/Space selecciona; Esc cierra el menú; **no** hay navegación por flechas entre options.
- Modales/ConfirmDialog: Esc cancela; a veces flechas entre botones.
- **No hay** navegación 2D por grid de cards.

### Logo fallback

- Archivo: `public/logos/alt-logo-blue.svg`.
- URL: `/logos/alt-logo-blue.svg`.
- Hoy **no** se usa en el feature de catálogos (otros logos sí en landing/admin).

---

## Cambios solicitados (requisito ↔ zona)

### 1. Pantalla previa — “Encuentra tu catálogo” (cards de CATALOGOS)

**Requisito:**

- Nueva pantalla **antes** de la primera experiencia actual de catálogos (dropdowns + tabla).
- Mostrar **todos los catálogos** visibles como **cards apretables**.
- Sección con:
  - Título tipo **“Encuentra tu catálogo”** (copy aproximado; puede refinarse sin cambiar el sentido).
  - **Buscador por nombre centrado**.
- Al abrir esta pantalla: **focus automático en el buscador**.
- Teclado:
  - **Esc** → salta el foco a la **primera card** de catálogos.
  - **Flechas** ↑ ↓ ← → → moverse entre cards (navegación tipo grilla 2D).
- Click en una card → entra a la pantalla de carpetas de ese catálogo (punto 2).

**Estado actual:** no existe; se aterriza en dropdowns y a menudo se auto-selecciona un catálogo.

**Zona probable:**

- `CatalogNavigator.tsx` (orquestar un “paso” / view state: `catalog-picker` | `folder-picker` | `products`).
- Posible extracción de componentes nuevos bajo `src/features/catalog/components/` (ej. grid + search).
- Estilos nuevos en `CatalogNavigator.module.scss` (o módulo hermano).
- Datos: `DirectoryCatalogItem[]` ya disponibles (`name`, `coverImageUrl`, `sectionCount`, …).
- Deep links: si llega `?catalog=...` (y opcionalmente `folder`), **saltar** el picker y respetar el deep link (sin romper dashboard/archivos). Si **no** hay `catalog` en URL, mostrar el picker en vez de auto-seleccionar el primero.

**Nota de diseño de datos:** para la imagen de la card de catálogo, reutilizar `coverImageUrl` / `Catalog.coverImagePath` existente. Si no hay imagen, definir fallback visual (puede ser el mismo logo blue u otro patrón de marca; el pedido explícito de logo blue está detallado sobre todo para **carpetas** en dropdown).

---

### 2. Pantalla de carpetas del catálogo (cards + Volver + admin imagen)

**Requisito:**

- Tras elegir un catálogo, nueva pantalla con:
  - Botón **“Volver a catálogos”** (vuelve al picker del punto 1; limpia selección de catálogo/folder de forma coherente con la URL).
  - **Todas las carpetas** del catálogo como **cards**.
  - Cada card de carpeta tiene una **imagen asociada**.
- Admin (solo `isAdmin`):
  - Botones **editar** y **eliminar** en las cards, **como en la lista actual** de catálogos/carpetas del dropdown (mismos handlers / ConfirmDialog de rename-delete).
  - Hover sobre la **imagen** → aparece **icono de editar**.
  - Click en ese editar de imagen → **modal**:
    - Título: **“Cambiar imagen”**.
    - Imagen actual en grande (si hay).
    - **Dropzone** indicando que se debe **arrastrar una imagen** ahí (y probablemente click-to-upload, siguiendo patrones existentes).
- Click en la card (zona no-admin o acción primaria) → abre la vista de productos de esa carpeta (flujo actual post-selección de folder).

**Estado actual:** carpetas solo en dropdown; sin cards; sin imagen de carpeta en schema/API.

**Zona / gap técnico crítico:**

- **Greenfield de datos:** agregar de forma **aditiva** algo como `coverImagePath String?` en `CatalogFolder` (nullable, default null) + migración no destructiva.
- Extender: `folder.service`, `folder.actions`, tipos `FolderListItem` / `CatalogNavigationFolderItem`, `navigation.service` (resolver signed URL como en catálogo), response de `/navigation`.
- UI: nueva grilla de cards; reutilizar patrones de dropzone de `ColumnEditModal` / `ProductFormModal`; modal estilo preview + form.
- Admin gates: mismos que hoy (`isAdmin` en UI; `requireAdmin()` en server).
- Edit/delete de **entidad** carpeta: reusar handlers existentes del navigator (no reinventar delete cascade semantics).

**Importante para el prompt del agent:** la imagen de **carpeta** no existe hoy; la de **catálogo** sí. No confundir ambos. El modal “Cambiar imagen” en la pantalla de carpetas es sobre **cover de carpeta**.

---

### 3. Miniaturas en el dropdown de carpetas (`DropdownOptionRow`)

**Requisito (DOM / UI citado por el usuario):**

En la lista de opciones del dropdown de carpetas (componente `DropdownOptionRow`, clases `.dropdownOption` / `.dropdownOptionContent`):

- A la **izquierda** del contenido textual (nombre + meta “N productos”), mostrar la **imagen de la carpeta** si existe.
- Si **no** hay imagen: mostrar el logo `public/logos/alt-logo-blue.svg` (`/logos/alt-logo-blue.svg`) dentro de un **cuadrado con border-radius**.
- La miniatura es **pequeña** pero con **altura suficiente para ocupar todo el alto** del bloque de contenido / fila de opción (~altura del `.dropdownOptionContent` / row ~38–63px).

**Estado actual:** solo texto + meta + acciones admin; sin thumbnail.

**Zona:**

- Extender `DropdownOption` con algo opcional tipo `imageUrl?: string | null` (o `imageSrc` + flag de fallback).
- Render en `DropdownOptionRow` dentro de `CustomDropdown.tsx`.
- Mapear en `CatalogFolderSelectors.tsx` desde el folder item (nueva URL de cover).
- SCSS en `CatalogNavigator.module.scss` (thumbnail + rounded square + object-fit).
- Aplicar al dropdown de **carpetas**; evaluar si el de catálogos también muestra `coverImageUrl` por consistencia (el pedido explícito del DOM Path es el dropdown de carpetas).

---

### 4. Integración con la pantalla “actual” de productos

**Requisito implícito:** una vez elegida la carpeta (desde cards o desde dropdown si sigue visible), el resto del flujo (tabla, filtros, search, CRUD productos) **no se rompe**.

**Decisiones que el prompt del agent debe resolver inspeccionando el código (sin inventar):**

- ¿Los dropdowns `CatalogFolderSelectors` siguen visibles en la vista de productos, o se reemplazan parcialmente por las nuevas pantallas?  
  - El pedido pide **pantallas previas** + **mejora del dropdown**; lo coherente es: picker cards para elegir, y en la vista de productos **mantener** (o adaptar) el toolbar/dropdowns existentes con la nueva miniatura.
- “Volver a catálogos” no debe borrar datos del servidor; solo estado de UI/URL.
- Auto-select del primer catálogo cuando no hay query: **reemplazar** por mostrar el picker (salvo deep link).

---

## Reglas de no-regresión / datos

1. **Aditivo:** nuevos campos nullable; no drop de columnas; no rewrite de productos.
2. **IDs estables:** `catalogId` / `folderId` y deep links `?catalog=&folder=` siguen válidos.
3. **Visibilidad:** respetar `visibilityService` / `visibleToNormalUser` (ADMIN ve todo; USUARIO filtrado).
4. **Permisos:** solo ADMIN sube/cambia/borra imágenes de cover y ve botones edit/delete; USUARIO ve cards e imágenes (o fallback) en solo lectura.
5. **Covers de catálogo existentes:** si ya hay `coverImagePath` en DB, deben aparecer en las nuevas cards sin migración manual.
6. **Carpetas sin imagen:** UI siempre tiene fallback (`/logos/alt-logo-blue.svg` al menos en dropdown; definir el mismo u otro para cards de carpeta).
7. **No perder** handlers actuales de create/rename/delete de catálogo y carpeta; solo re-exponerlos en cards además del dropdown.
8. Evitar hardcodear `coverImageUrl: null` en updates optimistas si se empieza a mostrar covers (bug latente actual en navigator).

---

## Patrones reutilizables (para el agent)

| Necesidad | Dónde mirar |
|-----------|-------------|
| Dropzone drag/drop + click | `ColumnEditModal.tsx` + clases `.columnEditDropzone*` |
| Dropzone productos | `ProductFormModal.tsx` + `.productFormImageDropzone*` |
| Modal imagen grande + Esc | `ProductImagePreviewModal.tsx` |
| Rename/delete confirm | `ConfirmDialog.tsx` |
| Upload cover catálogo (FormData) | `setCoverImageAction` / `catalog.service.setCoverImage` |
| Signed URL cover | `navigation.service` / `directory.service` (`resolveCoverImageUrl`) |
| Iconos Pencil/Trash2 | `@/shared/icons` (ya en `CustomDropdown`) |
| Auth flags | `toAdminUiAuth` → `isAdmin`, `canEdit` |

Para **folder cover**, espejar el patrón de catalog cover (service + action + signed URL), no el de imágenes de producto por columna (más complejo).

---

## Teclado — especificación deseada (picker de catálogos)

| Evento | Comportamiento |
|--------|----------------|
| Mount / open pantalla picker | Focus en input del buscador |
| Esc (con focus en buscador u origen definido) | Focus en la **primera card** de catálogos |
| ArrowUp / ArrowDown / ArrowLeft / ArrowRight | Mover foco/selección visual entre cards según layout de grilla (filas/columnas reales del CSS grid/flex) |
| Enter (en card focused) | Activar / abrir catálogo (equivalente a click) |
| Escritura en buscador | Filtra cards por **nombre** (client-side sobre lista directory) |

No confundir con la navegación ↑↓ de `CatalogGlobalSearchDropdown`.

---

## Checklist de archivos a tocar (orientativo para el prompt)

**Casi seguro:**

- `src/features/catalog/components/CatalogNavigator.tsx`
- `src/features/catalog/components/CatalogFolderSelectors.tsx`
- `src/features/catalog/components/CustomDropdown.tsx`
- `src/features/catalog/styles/CatalogNavigator.module.scss`
- `src/app/admin/catalogos/page.tsx` (solo si cambia semántica de `initialCatalogId` vacío)
- `prisma/schema.prisma` (+ migración aditiva para folder cover)
- `src/server/services/folder.service.ts`
- `src/server/services/navigation.service.ts`
- `src/features/catalog/actions/folder.actions.ts`
- `src/features/catalog/types/navigation.types.ts` / `folder.types.ts`

**Posible / nuevo:**

- Componentes `CatalogPickerGrid`, `FolderPickerGrid`, `ChangeCoverImageModal` (nombres tentativos).
- Tests unitarios de service/actions de folder cover y de teclado del picker si el repo ya testea flujos similares.

**Reutilizar sin romper:**

- `catalog.actions.ts` cover APIs para cards de **catálogo** (si el pedido de editar imagen también aplica a covers de catálogo en el picker; el texto del usuario detalla el modal sobre **carpetas**).
- Deep links desde `dashboard.service.ts`, `UploadedFilesList.tsx`.

---

## Ambigüedades a resolver en el prompt (pedirle al agent que elija con criterio del repo, no invente producto)

1. ¿Las cards de **catálogo** también permiten cambiar cover con el mismo modal, o solo las de **carpeta**? (Backend de catálogo ya existe; el texto del usuario enfatiza carpetas.)
2. ¿Tras “Volver a catálogos” se limpia `?catalog`/`?folder` de la URL?
3. ¿En vista productos se ocultan las pantallas de cards y quedan solo dropdowns+tabla, o hay breadcrumb permanente?
4. ¿Click en la imagen (no-admin) hace algo o solo el click de la card selecciona la carpeta?
5. Formatos de imagen aceptados: alinear con dropzones existentes (JPG/PNG/WebP).

El prompt ideal debe **fijar defaults razonables** para 1–5 basándose en el pedido y en patrones del repo, y marcarlos explícitamente.

---

## Bullets copy-ready para el prompt del coding agent

1. Implementar en `/admin/catalogos` un flujo en pasos: **picker de catálogos (cards + search)** → **picker de carpetas (cards + Volver a catálogos)** → **vista productos actual**; respetar deep links `?catalog=&folder=`.
2. Picker de catálogos: título “Encuentra tu catálogo”, search centrado, autofocus, Esc → primera card, flechas 2D entre cards, filtro por nombre.
3. Picker de carpetas: cards con imagen; admin ve edit/delete de entidad como en dropdown; hover imagen admin → icono editar → modal “Cambiar imagen” + preview + dropzone.
4. Extender schema/API de **folder cover** de forma aditiva; reutilizar cover de **catalog** ya existente para cards de catálogo.
5. Extender `DropdownOption`/`DropdownOptionRow` con miniatura a la izquierda; fallback `/logos/alt-logo-blue.svg` en cuadrado rounded; altura ≈ alto de la fila/contenido.
6. No perder datos ni romper CRUD/visibilidad/URL; no hardcodear covers a null en optimistic updates.
7. Inspeccionar archivos listados; reutilizar dropzone/modal/auth existentes; no inventar paths.

---

## Ejemplo de pedido a ChatGPT (opcional)

> Con el documento anterior como única fuente de alcance, generá un **prompt ideal en español** para un coding agent que implemente esta UX de catálogos por cards + covers de carpetas + miniaturas en el dropdown. El prompt debe ser accionable, citar rutas del repo, separar actual vs deseado, fijar defaults en las ambigüedades, y enfatizar cambios aditivos sin pérdida de datos.
