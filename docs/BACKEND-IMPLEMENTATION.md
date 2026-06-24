# BACKEND-IMPLEMENTATION — Plan de implementación backend

> Derivado de [`PRD.md`](./PRD.md). Orden por **dependencias técnicas**, alineado con el estado del repositorio.  
> **Contexto rápido para agentes:** [`AGENT-BRIEF.md`](./AGENT-BRIEF.md) · **API:** [`ENDPOINTS.md`](./ENDPOINTS.md) · **Schema:** [`prisma/schema.prisma`](../prisma/schema.prisma)

---

## Tabla de contenidos

- [1. Estado actual](#1-estado-actual)
- [2. Contexto y principios](#2-contexto-y-principios)
- [3. Arquitectura y stack](#3-arquitectura-y-stack)
- [4. Modelo de datos](#4-modelo-de-datos)
- [5. Servicios y visibilidad](#5-servicios-y-visibilidad)
- [6. Importación (referencia)](#6-importación-referencia)
- [7. Fases de implementación](#7-fases-de-implementación)
- [8. Requerimientos y criterios](#8-requerimientos-y-criterios)

---

## 1. Estado actual

**Rama:** `backend` · **Fases completadas:** 1, 2, 3 (3.1–3.8), 4, 5, 6, 7

### 1.1 Roadmap PRD ↔ backend

| Fase PRD (§48) | Fase backend | Estado |
|----------------|--------------|--------|
| 1 — Base visual y acceso | 2 — Base del sistema | ✅ |
| 2 — Modelo Catálogo-Carpeta-Producto | 3 — Catálogos y carpetas | ✅ |
| 3 — Administración manual | 6 | ✅ |
| 4 — Filtros y búsqueda | 7 | ✅ |
| 5 — Importador | 4 | ✅ |
| 6 — Imágenes | 5 | ✅ |
| 7 — Archivos subidos | 8 | ⏳ |
| 8 — Offline | 9 | ⏳ |
| 9 — Pruebas y entrega | 10 | ⏳ |
| — | 1 — Análisis | ✅ |

### 1.2 Inventario implementado

| Área | Detalle |
|------|---------|
| **Stack** | Next.js 16, React 19, TypeScript, Prisma 7, Supabase Auth + Storage |
| **Modelos Prisma** | … + `GlobalField` (Fase 7) |
| **Migraciones** | … + `20260624211539_*`, `20260624220000_phase7_search_indexes` |
| **Servicios** | … + **SearchService**, **ColumnFilterService**, **GlobalFieldService** |
| **APIs** | … + búsqueda catálogo/global, listado carpeta con `q`/`filters` |
| **Pendiente** | UI (import, imágenes, productos, ayuda columnas, buscador/filtros en tabla), listado archivos (Fase 8), offline |

### 1.3 Glosario PRD ↔ código

| PRD | Código | Notas |
|-----|--------|-------|
| Carpeta | `CatalogFolder` | |
| Producto | `Product` | |
| Usuario normal | Rol `CONSULTA` | PRD usa `USER` |
| Administrador | Rol `ADMIN` | |

---

## 2. Contexto y principios

### 2.1 Modelo de dominio (PRD §7)

```text
Catálogo → Carpeta (hoja Excel) → Producto (fila)
```

Ejemplos: Rulemanes (3 hojas, embebidas), Catálogo Azul (~35 hojas, índice → directorio automático), Embragues (`.xlsm`, externas por código, sin macros).

### 2.2 Principios backend

- **Flexibilidad:** columnas, filtros e imágenes distintos por carpeta; datos variables en JSONB.
- **Preservación:** original en Storage, nombres de columnas, saltos de línea, fórmulas como valor calculado (sin ejecutar).
- **Seguridad:** catálogos privados; ocultamiento real por rol en APIs.
- **Sin NestJS** (PRD §44, §49). Backend en Next.js (Route Handlers + Server Actions + Services + Repositories).
- **Sin** tabla física por Excel, macros VBA ni rutas Windows locales.

### 2.3 Restricciones de alcance (PRD §49)

No MVP: macros, edición Excel web, OCR/IA, multiempresa, facturación/stock, NestJS. Ver §8.3.

---

## 3. Arquitectura y stack

```text
src/
├── app/           → (public), auth/, admin/, api/admin/
├── features/      → schemas Zod, actions, tipos por dominio
└── server/
    ├── services/  → lógica de negocio
    ├── repositories/ → Prisma
    ├── auth/, storage/, database/
    ├── importers/   → parseo ExcelJS
    ├── image-processors/ → sharp, ZIP seguro, integridad
    └── search/, filters/  → SearchService, ColumnFilterService
```

| Capa | Uso |
|------|-----|
| Route Handlers | Uploads, descargas, consultas paginadas, sync offline |
| Server Actions | Mutaciones del panel admin |
| Services | Reglas, transacciones, visibilidad |
| Repositories | Queries Prisma |

| Componente | Tecnología |
|------------|------------|
| DB | PostgreSQL (Supabase) + JSONB |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Auth / Storage | Supabase |
| Excel | ExcelJS |
| Imágenes | sharp, unzipper |
| Validación | Zod |

**Almacenamiento (§43):** relacional para entidades; JSONB en `Product.dynamicData`; índices GIN y normalizados para búsqueda futura.

---

## 4. Modelo de datos

> Definición canónica en `prisma/schema.prisma`. Entidades futuras se añaden por fase.

### 4.1 Implementado ✅

| Entidad | Campos clave | Fase |
|---------|--------------|------|
| `User` | UUID = Supabase Auth, rol, estado | 2 |
| `Catalog` | nombre, orden, status, `visibleToNormalUser`, `coverImagePath` | 2–3 |
| `CatalogFolder` | catálogo, orden, `searchConfig`/`filterConfig` JSON, visibilidad | 3 |
| `FolderColumn` | tipos semánticos, buscable/filtrable/global, `globalFieldKey` placeholder | 3 |
| `Product` | `dynamicData` JSONB, código/descripción, texto indexado, imágenes, equivalencias | 3, 5, 6 |
| `EquivalentCode` | códigos equivalentes normalizados por producto | 6 |
| `ProductImage` | embebidas/externas; estados §4.3; miniatura + original en Storage | 5 |
| `UploadedFile` | respaldo Excel en Storage, estado, usuario | 4 |
| `ImportJob` | asistente, destino, estados, config/resultados JSON | 4 |
| `ImportSheet` | hojas detectadas y clasificadas | 4 |
| `ImportPreview` | productos reconocidos, coincidencias, advertencias | 4 |
| `AuditLog` | acción, entidad, userId opcional | 2 |

**Enums:** `UserRole`, `UserStatus`, `CatalogStatus`, `FolderStatus`, `ColumnDataType`, `UploadedFileStatus`, `ImportJobStatus`, `ImportActionType`, `ImportSheetClassification`, `ProductImageStatus`, `ProductImageSource`.

### 4.2 Pendiente ⏳

| Entidad | Fase | Propósito |
|---------|------|-----------|
| `GlobalField` | 7 | ✅ Registry + seeds; mapeo vía `FolderColumn.globalFieldKey` |
| `OfflineSyncManifest` | 9 | Sincronización offline |

> `EquivalentCode` implementado en Fase 6. `UploadedFile` listado/reprocesar UI → Fase 8 (`UploadedFileService`).

### 4.3 Estados de imagen (PRD §27) — Fase 5 ✅

`ASSOCIATED_AUTO`, `ASSOCIATED_MANUAL`, `PENDING_REVIEW`, `FILE_NOT_FOUND`, `AMBIGUOUS`, `DUPLICATE_NAME`, `FORMAT_REJECTED`, `DELETED`.

### 4.4 Operaciones admin clave (PRD §14)

- **Borrar catálogo/carpeta:** elimina datos Prisma; **no** el Excel original.
- **Vaciar:** elimina productos; conserva estructura y configuración.
- **Hojas auxiliares:** clasificación `IMPORTABLE` | `INDEX` | `AUXILIARY` | `IGNORED` (`ExcelStructureService`).

---

## 5. Servicios y visibilidad

### 5.1 Servicios

| Servicio | Estado | Responsabilidad |
|----------|--------|-----------------|
| AuthService, UserService | ✅ | Sesión, CRUD usuarios (ADMIN) |
| CatalogService, FolderService | ✅ | CRUD, vaciado, visibilidad, orden |
| ColumnConfigService | ✅ | CRUD columnas, metadatos semánticos |
| ColumnHelpService | ✅ | Texto/imagen de ayuda, URLs firmadas, `hasContextualHelp` |
| ProductService | ✅ | Paginación, CRUD manual, duplicar, `indexedText`; validación por `FolderColumn` |
| EquivalenceService | ✅ | Parseo multi-código, sync en import y CRUD, alta/baja manual |
| VisibilityService | ✅ | Filtrado real para rol `CONSULTA` |
| NavigationService, DirectoryService | ✅ | Directorio y navegación por catálogo |
| ExcelStructureService | ✅ | Clasificación hojas + delegación parseo ExcelJS |
| AuditService | ✅ | Operaciones críticas; `IMPORT_PUBLISHED` |
| CatalogImportService | ✅ | Asistente 6 pasos, publicación segura, combinar/reemplazar |
| ImageExtractionService, ImageMatchingService, ProductImageService | ✅ | Extracción embebida, matching externo, revisión, URLs firmadas (Fase 5) |
| SearchService, ColumnFilterService, GlobalFieldService | ✅ | Búsqueda normalizada, filtros acumulables, campos globales |
| UploadedFileService, OfflineSyncService | ⏳ | Listado archivos (Fase 8), sync |

### 5.2 Visibilidad (PRD §9) ✅

Tres niveles: catálogo → carpeta → columna (`visibleToNormalUser`).

- `CONSULTA`: entidades ocultas excluidas de directorio, navegación, columnas y productos (404 genérico).
- `ADMIN`: ve todo. Buscable/filtrable **≠** visible (configuraciones independientes).
- Integrado en: `DirectoryService`, `NavigationService`, `ProductService`, `ColumnConfigService`.

---

## 6. Importación (referencia)

> Detalle completo para Fase 4. Flujo PRD §17 / §47.

```text
Subir Excel (+ ZIP/imágenes) → respaldo Storage → elegir catálogo/carpeta [+]
→ detectar hojas/columnas/fórmulas/imágenes → vista previa
→ carpeta vacía: Aplicar | con productos: Combinar / Reemplazar (+ confirmación)
→ staging → revisión imágenes → transacción atómica → directorio actualizado
```

### 6.1 Estados ImportJob (publicación segura — PRD §21)

`STORED` → `ANALYZING` → `PENDING_DESTINATION` → `PENDING_CONFIG` → `READY_TO_APPLY` → (`apply`) → `PROCESSING` → `PENDING_REVIEW` | `PUBLISHED` → (revisión) → `PUBLISHED` | `FAILED` | `CANCELLED`

> Datos activos no se reemplazan hasta confirmación exitosa (RF-044).

### 6.2 Estrategias de lista (PRD §18)

| Escenario | Acciones |
|-----------|----------|
| Carpeta vacía | Cancelar / Aplicar |
| Con productos | Combinar (omitir coincidentes MVP) / Reemplazar (+ confirmación) |

Coincidencias por código principal, normalizado, imagen, referencia, equivalencias.

### 6.3 Informe (PRD §22)

Persistir en `ImportJob.resultados`: hojas, productos creados/omitidos/coincidentes, fórmulas, imágenes, columnas, errores/advertencias, acción aplicada.

### 6.4 Formatos y reglas

- MVP: `.xlsx`, `.xlsm` (sin VBA). Validar MIME/tamaño/integridad.
- Fórmulas: valor calculado; no ejecutar en servidor.
- Macros: no ejecutar; análisis opcional de relaciones (Embragues).

---

## 7. Fases de implementación

---

### Fase 1 — Análisis ✅

Documentación de dominio con Pablo (Rulemanes, Catálogo Azul, Embragues): columnas, equivalencias, filtros, imágenes externas, hojas auxiliares.

---

### Fase 2 — Base del sistema ✅ (2026-06-18)

Infraestructura: DB, Storage, Auth, Usuarios, Directorio, Auditoría.

| # | Entregable | Resultado |
|---|------------|-----------|
| 2.1 | Base de datos | `User`, `Catalog`, `AuditLog` · migración `20260617182823_*` |
| 2.2 | Storage | Buckets privados · `src/server/storage/` · límites 50 MB Excel / 10 MB imágenes |
| 2.3 | Auth | Supabase SSR, middleware, guards, recuperación contraseña, `/auth/callback` |
| 2.4 | Usuarios | `UserService` CRUD solo ADMIN; desactivación cierra sesiones |
| 2.5 | Directorio | `DirectoryService` — catálogos ACTIVE ordenados |
| 2.6 | Auditoría | `AuditLog` en login, usuarios, catálogos, carpetas |

**RF cubiertos:** RF-001, RF-002, RF-003, RF-004 (parcial despliegue).  
**Verificación:** `pnpm db:verify` · `pnpm storage:verify` · `pnpm auth:verify`  
**Contratos:** [`ENDPOINTS.md`](./ENDPOINTS.md)

---

### Fase 3 — Catálogos y carpetas ✅

CRUD catálogos/carpetas/columnas, lectura paginada de productos, visibilidad por rol, navegación.

| # | Entregable | Componentes |
|---|------------|-------------|
| 3.1 | Modelos Prisma | `CatalogFolder`, `FolderColumn`, `Product` · migración `20260619214310_*` |
| 3.2 | Catálogos | `CatalogService` — CRUD, vaciado, portada, visibilidad |
| 3.3 | Carpetas | `FolderService` — CRUD, vaciado, `searchConfig`/`filterConfig` JSON |
| 3.4 | Hojas auxiliares | `ExcelStructureService`, `SheetClassification` (sin parseo Excel) |
| 3.5 | Columnas | `ColumnConfigService` — visibilidad, buscable, filtrable, tipos semánticos |
| 3.6 | Productos | `ProductService` — `GET .../folders/{id}/products` paginado (solo lectura) |
| 3.7 | Visibilidad | `VisibilityService` en todas las lecturas |
| 3.8 | Navegación | `GET .../catalogs/{id}/navigation` |

**Decisiones de alcance:** Excel ↔ catálogo (`UploadedFile`) en Fase 4; CRUD manual productos en Fase 6; motor búsqueda/filtros en Fase 7; `GlobalFieldMapping` en Fase 7.6.

**Verificación:** `pnpm lint` · `pnpm test:run` · `pnpm db:verify`

---

### Fase 4 — Importador ✅ (2026-06-22)

**PRD fase 5** · Depende de Fase 3

Asistente guiado 6 pasos, publicación segura, combinar/reemplazar/aplicar lista. **Un job = una hoja → una carpeta.** Imágenes: solo detección/conteo (extracción en Fase 5).

| # | Entregable | Componentes |
|---|------------|-------------|
| 4.1 | Modelos Prisma | `UploadedFile`, `ImportJob`, `ImportSheet`, `ImportPreview` · migración `20260622225542_*` |
| 4.2 | ExcelJS | `src/server/importers/` — workbook/sheet/cell parser, image detector, column/product mappers |
| 4.3 | Repositories | `uploaded-file`, `import-job`; `product.repository` bulk (`createMany`, `deleteByFolder`) |
| 4.4 | CatalogImportService | Máquina de estados, preview, coincidencias, publicación atómica |
| 4.5 | REST | `POST .../imports/upload`, `GET .../imports/{id}`, `/sheets`, `/preview`, `/report` |
| 4.6 | Server Actions | `analyzeImportAction`, `setImportDestinationAction`, `setImportConfigAction`, `applyImportAction`, `cancelImportAction` |
| 4.7 | Tests | `test/unit/server/importers/*`, `catalog-import.service.test.ts` |
| 4.8 | Documentación | [`ENDPOINTS.md`](./ENDPOINTS.md) contratos importador |

**Estados `ImportJob`:** `STORED` → `ANALYZING` → `PENDING_DESTINATION` → `PENDING_CONFIG` → `READY_TO_APPLY` → (`apply`) → `PROCESSING` → `PUBLISHED` | `PENDING_REVIEW` | `FAILED` | `CANCELLED`  
(`PENDING_REVIEW` tras `apply` si quedan imágenes por revisar — Fase 5)

**Estrategias:** `IMPORTAR_LISTA` (carpeta vacía), `COMBINAR_LISTA` (omitir coincidentes), `REEMPLAZAR_LISTA` (confirmación obligatoria).

**Verificación:** `pnpm lint` · `pnpm test:run` · `pnpm db:verify` ✅

**Pendiente UI:** cablear asistente en `/admin/archivos` contra APIs documentadas.

---

### Fase 5 — Imágenes ✅ (2026-06-23)

**PRD fase 6** · Depende de Fase 4

Extracción embebida, importación externa (ZIP/sueltas), matching por código/nombre, miniaturas, revisión manual y URLs firmadas. **Backend listo; UI pendiente** (miniaturas en tabla, panel revisión, modal RF-032).

| # | Entregable | Componentes |
|---|------------|-------------|
| 5.1 | Modelos Prisma | `ProductImage`, enums `ProductImageStatus`/`ProductImageSource`, `PENDING_REVIEW` en `ImportJob` · migración `20260623134707_*` |
| 5.2 | Processors | `src/server/image-processors/` — `sharp` miniaturas, integridad, ZIP seguro (`unzipper`) |
| 5.3 | Servicios | `ImageExtractionService`, `ImageMatchingService`, `ProductImageService` |
| 5.4 | Repository | `product-image.repository` |
| 5.5 | Integración import | `CatalogImportService.apply` → `PROCESSING` → imágenes → `PENDING_REVIEW` \| `PUBLISHED`; `uploadImportImages`, `completeImageReview` |
| 5.6 | REST | `POST .../upload` (+ ZIP/`images[]`), `POST .../images`, `GET .../images/review`, `PATCH/DELETE .../images/{id}`, `GET .../products/{id}/images` |
| 5.7 | Server Actions | `listImportImageReviewAction`, `associateImportImageAction`, `updateImportImageAction`, `deleteImportImageAction`, `completeImageReviewAction` |
| 5.8 | Productos | `ProductTableItem.primaryImage` con URLs firmadas |
| 5.9 | Tests | `image-matching`, `image-processors`, `catalog-import` (review), `product.service` |
| 5.10 | Documentación | [`ENDPOINTS.md`](./ENDPOINTS.md) contratos imágenes |

**Flujo:** apply → procesar embebidas + externas → si hay `PENDING_REVIEW`/`AMBIGUOUS` → revisión admin → `completeImageReview` → `PUBLISHED`.

**Completitud:** Rulemanes/Catálogo Azul embebidas; Embragues externas por código (sin rutas Windows).

**Verificación:** `pnpm lint` · `pnpm test:run` (168 tests) · `pnpm db:verify` · `pnpm storage:verify` ✅

**Pendiente UI:** miniaturas en tabla, panel revisión import, modal ampliado.

---

### Fase 6 — Administración manual ✅ (2026-06-24)

**PRD fase 3** · Depende de Fases 3, 5

| # | Entregable | Componentes |
|---|------------|-------------|
| 6.1 | Modelo Prisma | `EquivalentCode` · migración `20260624133350_*` |
| 6.2 | Builders | `product-field.builder.ts`, `equivalence.parser.ts` |
| 6.3 | Equivalencias | `EquivalenceService`, `equivalent-code.repository`; hook en `CatalogImportService.apply` |
| 6.4 | CRUD productos | `ProductService` create/update/delete/duplicate/get; `product.repository` |
| 6.5 | Imágenes manuales | `ProductImageService` upload/replace/update/delete sin `importJobId` |
| 6.6 | REST | `POST .../folders/{id}/products`, `GET/PATCH/DELETE .../products/{id}`, duplicate, equivalences, imágenes |
| 6.7 | Server Actions | `features/records/actions/product.actions.ts`, `features/product-images/actions/` |
| 6.8 | Auditoría | `PRODUCT_*`, `EQUIVALENCE_*` en `AuditLog` |
| 6.9 | Tests | `equivalence.parser`, `product-field.builder`, `equivalence.service`, `product.service` |
| 6.10 | Documentación | [`ENDPOINTS.md`](./ENDPOINTS.md) contratos Fase 6 |
| 6.11 | Ayuda contextual columnas | `ColumnHelpService`, bucket `column-help-images`, campos en `FolderColumn`, REST + actions · migración `20260624211539_*` |

**Verificación:** `pnpm lint` · `pnpm test:run` · `pnpm db:verify` · `pnpm storage:verify` ✅

**Pendiente UI:** formulario crear/editar producto, duplicar, gestión imágenes en tabla, ícono Info / popover / modal de ayuda en cabeceras.

---

### Fase 7 — Búsqueda y filtros ✅

**PRD fase 4** · Depende de Fases 3, 6

| # | Entregable | Detalle |
|---|------------|---------|
| 7.1 | Normalización | `search-normalizer.ts` — RF-034 |
| 7.2 | Búsqueda | `SearchService` — carpeta (en listado), catálogo, global — RF-035–038 |
| 7.3 | Índices | `pg_trgm` GIN en `indexedText`/`description`; migración `20260624220000_*` |
| 7.4 | Filtros | `ColumnFilterService` — AND, `activeFilters` pills — RF-039–041 |
| 7.5 | GlobalField | Modelo + seeds; validación `globalFieldKey` — RF-042 parcial |
| 7.6 | Indexación import | `buildIndexedTextForMappedProduct` en `CatalogImportService.apply` |
| 7.7 | REST | `GET .../products?q&filters`, `GET .../catalogs/{id}/search`, `GET /api/admin/search/global` |
| 7.8 | Backfill | `scripts/reindex-folder-products.ts` |
| 7.9 | Tests | `search-normalizer`, `search-config`, `search.service`, `column-filter.service` |

**Verificación:** `pnpm lint` · `pnpm test:run` (243) · `pnpm db:verify` · `pnpm storage:verify` ✅

**Pendiente UI:** barra búsqueda, filtros por columna, pills, debounce 250–300 ms en `CatalogNavigator`/`ProductTable`.

**Completitud backend:** `2902`, `1408`, `0193-SILVA` vía equivalencias normalizadas; filtros acumulables operativos en API.

---

### Fase 8 — Archivos y reimportación ⏳

**PRD fase 7** · Depende de Fases 4, 7

- [ ] `UploadedFileService` — listado, descarga original, informe, reprocesar, combinar/reemplazar
- [ ] Reimportación con publicación segura §6.2; conservar archivos anteriores

---

### Fase 9 — Offline ⏳

**PRD fase 8** · Depende de Fase 7

- [ ] `OfflineSyncManifest`; payloads versionados (catálogos, productos, equivalencias, miniaturas)
- [ ] Endpoints sync; **sin** Excel originales offline
- [ ] Bloqueo mutaciones sin conexión; señal `grg:offline:clear` al logout (ya preparada)

---

### Fase 10 — Pruebas y entrega ⏳

- [ ] Archivos reales: Rulemanes, Catálogo Azul, Embragues (§50)
- [ ] Rendimiento: paginación, progreso importación, búsquedas indexadas
- [ ] Seguridad: Storage privado, ZIP seguro, ocultamiento por rol
- [ ] Despliegue `www.rothamelrepuestos.com.ar` · `prisma migrate deploy` en CI/CD
- [ ] Guía operativa para Pablo + runbook recuperación

---

## 8. Requerimientos y criterios

### 8.1 Requerimientos funcionales (PRD §40)

| ID | Requerimiento | Fase | Estado |
|----|---------------|------|--------|
| RF-001 | Autenticación | 2 | ✅ |
| RF-002 | Roles | 2 | ✅ |
| RF-003 | Landing pública | 2 | ✅ |
| RF-004 | Dominio | 2/10 | ⏳ |
| RF-005 | Estructura Catálogo-Carpeta-Producto | 3 | ✅ |
| RF-006 | Gestión catálogos | 3 | ✅ |
| RF-007 | Gestión carpetas | 3 | ✅ |
| RF-008 | Gestión productos | 6 | ✅ |
| RF-009 | Edición columnas | 3/6 | ✅ config + valores |
| RF-010–012 | Visibilidad catálogo/carpeta/columna | 3 | ✅ |
| RF-013–016 | Subida y destino importación | 4 | ✅ |
| RF-017 | Análisis hojas | 4 | ✅ |
| RF-018–027 | Detección, vista previa, listas, fórmulas | 4 | ✅ |
| RF-028–032 | Imágenes | 5 | ✅ backend / ⏳ UI modal (RF-032) |
| RF-033 | Equivalencias | 6–7 | ✅ persistencia + búsqueda |
| RF-034–041 | Búsqueda y filtros | 7 | ✅ backend |
| RF-042 | Configuración columnas | 3 | ✅ |
| RF-043 | Archivos subidos | 8 | ⏳ |
| RF-044 | Publicación segura | 4 | ✅ |
| RF-045–047 | Offline | 9 | ⏳ |
| RF-048 | Nombre visible de columnas | 3/6 | ✅ |
| RF-049 | Nombre original no editable | 3/6 | ✅ |
| RF-050 | Ayuda contextual de columnas | 6.11 | ✅ backend |
| RF-051 | Ícono Info en columnas | 6.11 | ✅ backend (`hasContextualHelp`) / ⏳ UI |
| RF-052 | Modal imagen de ayuda | 6.11 | ✅ backend (URLs firmadas) / ⏳ UI |

### 8.2 Requerimientos no funcionales (PRD §41)

- **Rendimiento:** paginación obligatoria; miniaturas en listados; índices búsqueda; progreso en importaciones; meta < 5 min a resultados relevantes.
- **Seguridad:** middleware, roles, rate limit (login/import), redirect seguro, Storage privado, MIME/ZIP seguro, URLs firmadas, `AuditLog`, ocultamiento real por rol, `handleAdminApiError`.
- **Usabilidad API:** JSON claro, vista previa importación, informes comprensibles.
- **Compatibilidad:** Chrome/Edge/navegadores modernos; JSON para PWA.

### 8.3 Criterios de aceptación (PRD §50)

| Área | Estado |
|------|--------|
| **Base (Fase 2)** | ✅ Auth, roles, directorio, auditoría — ver [`ENDPOINTS.md`](./ENDPOINTS.md) |
| **Catálogos y carpetas** | ✅ Directorio automático, CRUD, columnas por carpeta, visibilidad, vaciado/borrar |
| **Usuarios** | ✅ Admin edita; CONSULTA solo ve. Controles UI ocultos → frontend |
| **Importación** | ✅ Backend (sin UI asistente) — ver [`ENDPOINTS.md`](./ENDPOINTS.md) |
| **Imágenes** | ✅ Backend (extracción, matching, revisión, miniaturas API) — ⏳ UI modal/panel |
| **Productos manuales** | ✅ Backend (CRUD, equivalencias, imágenes manuales) — ⏳ UI formulario |
| **Ayuda contextual columnas** | ✅ Backend (texto, imagen Storage, `hasContextualHelp`, URLs firmadas) — ⏳ UI ícono Info / popover / modal |
| **Búsqueda y filtros** | ✅ Backend — ⏳ UI buscador/pills en tabla |
| **Archivos / Offline** | ⏳ |

### 8.4 Criterios de éxito (PRD §51)

Pablo deja el pendrive; directorio automático; hojas → carpetas; búsqueda sin conocer archivo origen; equivalencias y filtros < 5 min; imágenes sin rutas locales; originales respaldados; offline tras sync; sistema comprensible para ambos locales.

### 8.5 Supuestos (PRD §52)

Pablo confirma columnas visibles/buscables/filtrables; imágenes externas con nombres originales; asociaciones pueden requerir revisión manual; fórmulas sin garantía de valor calculado; offline requiere sync previa; rol `CONSULTA` = usuario normal PRD.

---

## Referencias

- [`docs/PRD.md`](./PRD.md) · [`docs/ENDPOINTS.md`](./ENDPOINTS.md) · [`README.md`](../README.md)
