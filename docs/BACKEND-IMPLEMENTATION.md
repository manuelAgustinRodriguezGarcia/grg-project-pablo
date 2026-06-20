# BACKEND-IMPLEMENTATION — Plan de implementación backend

> Derivado de [`PRD.md`](./PRD.md). Orden por **dependencias técnicas**, alineado con el estado del repositorio.  
> **Detalle de API y contratos:** [`ENDPOINTS.md`](./ENDPOINTS.md) · **Schema:** [`prisma/schema.prisma`](../prisma/schema.prisma)

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

**Rama:** `backend` · **Fases completadas:** 1, 2, 3 (3.1–3.8)

### 1.1 Roadmap PRD ↔ backend

| Fase PRD (§48) | Fase backend | Estado |
|----------------|--------------|--------|
| 1 — Base visual y acceso | 2 — Base del sistema | ✅ |
| 2 — Modelo Catálogo-Carpeta-Producto | 3 — Catálogos y carpetas | ✅ |
| 3 — Administración manual | 6 | ⏳ |
| 4 — Filtros y búsqueda | 7 | ⏳ |
| 5 — Importador | 4 | ⏳ |
| 6 — Imágenes | 5 | ⏳ |
| 7 — Archivos subidos | 8 | ⏳ |
| 8 — Offline | 9 | ⏳ |
| 9 — Pruebas y entrega | 10 | ⏳ |
| — | 1 — Análisis | ✅ |

### 1.2 Inventario implementado

| Área | Detalle |
|------|---------|
| **Stack** | Next.js 16, React 19, TypeScript, Prisma 7, Supabase Auth + Storage |
| **Modelos Prisma** | `User`, `Catalog`, `CatalogFolder`, `FolderColumn`, `Product`, `AuditLog` |
| **Migraciones** | `20260617182823_init_user_catalog_audit_log`, `20260619214310_add_catalog_folder_product_models` |
| **Auth** | `src/server/auth/`, middleware `/admin` + `/api/admin`, guards, Server Actions |
| **Storage** | Buckets privados `excel-originals`, `product-images`, `temp-imports` |
| **Servicios** | Auth, User, Catalog, Folder, ColumnConfig, Product (lectura), Visibility, Navigation, Directory, Audit, ExcelStructure (clasificación) |
| **APIs** | `GET /api/admin/directory`, `GET /api/admin/catalogs/{id}/navigation`, `GET /api/admin/folders/{id}/products` |
| **Pendiente** | Importador, imágenes, CRUD manual productos, búsqueda/filtros, archivos, offline |

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
    └── (futuro) importers/, search/, filters/
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
| `Product` | `dynamicData` JSONB, código/descripción, texto indexado | 3 |
| `AuditLog` | acción, entidad, userId opcional | 2 |

**Enums:** `UserRole`, `UserStatus`, `CatalogStatus`, `FolderStatus`, `ColumnDataType`.

### 4.2 Pendiente ⏳

| Entidad | Fase | Propósito |
|---------|------|-----------|
| `EquivalentCode` | 6–7 | Equivalencias normalizadas |
| `ProductImage` | 5 | Embebidas/externas/manuales; estados §6.2 |
| `UploadedFile` | 4/8 | Historial y respaldo de originales |
| `ImportJob`, `ImportPreview`, `ImportSheet` | 4 | Asistente y publicación segura |
| `GlobalFieldMapping` | 7 | Filtros globales |
| `OfflineSyncManifest` | 9 | Sincronización offline |

### 4.3 Estados de imagen (PRD §27) — Fase 5

Asociada (auto/manual), pendiente revisión, no encontrada, ambigua, duplicada, rechazada, eliminada.

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
| ProductService | ✅ lectura / ⏳ CRUD | Paginación + JSONB filtrado |
| VisibilityService | ✅ | Filtrado real para rol `CONSULTA` |
| NavigationService, DirectoryService | ✅ | Directorio y navegación por catálogo |
| ExcelStructureService | 🔄 | Clasificación hojas ✅; parseo ⏳ Fase 4 |
| AuditService | ✅ | Operaciones críticas |
| CatalogImportService | ⏳ | Asistente 6 pasos, publicación segura |
| ImageExtraction/MatchingService | ⏳ | Imágenes embebidas/externas |
| SearchService, ColumnFilterService | ⏳ | Búsqueda normalizada, filtros acumulables |
| UploadedFileService, OfflineSyncService | ⏳ | Archivos, sync |

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

`STORED` → `ANALYZING` → `PENDING_DESTINATION` → `PENDING_CONFIG` → `PROCESSING` → `PENDING_REVIEW` → `READY_TO_APPLY` → `PUBLISHED` | `FAILED` | `CANCELLED`

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

### Fase 4 — Importador ⏳

**PRD fase 5** · Depende de Fase 3

Asistente guiado 6 pasos, publicación segura, combinar/reemplazar/aplicar lista.

- [ ] Modelos: `UploadedFile`, `ImportJob`, `ImportPreview`, `ImportSheet`
- [ ] Upload multipart `.xlsx`/`.xlsm`; respaldo **antes** de procesar
- [ ] Pasos §6: subir → destino `[+]` → detectar estructura → vista previa → estrategia lista → confirmación
- [ ] `ExcelStructureService` + `CatalogImportService`: mapeo semántico; no mapeados → JSONB
- [ ] Fórmulas (valor calculado); sin macros
- [ ] Máquina de estados §6.1; transacción atómica al publicar
- [ ] Progreso e informe §6.3

**Completitud:** importar Rulemanes o Catálogo Azul; combinar/reemplazar con confirmación; original respaldado.

---

### Fase 5 — Imágenes ⏳

**PRD fase 6** · Depende de Fase 4

- [ ] `ProductImage` con estados §4.3
- [ ] Embebidas: `ImageExtractionService` (hoja/fila/columna)
- [ ] Externas: ZIP/sueltas; `ImageMatchingService` por código/nombre (sin rutas Windows)
- [ ] Formatos `.jpg`/`.jpeg`/`.png`/`.webp`; error parcial si imagen dañada
- [ ] Miniaturas + URLs firmadas; API revisión (ambiguas, asociar, principal, orden)

**Completitud:** Rulemanes/Catálogo Azul embebidas; Embragues externas por código.

---

### Fase 6 — Administración manual ⏳

**PRD fase 3** · Depende de Fases 3, 5

- [ ] CRUD productos: crear, editar, eliminar, **duplicar** según `FolderColumn`
- [ ] `EquivalenceService` — multi-código, revisión manual
- [ ] Imágenes manuales: agregar, reemplazar, principal, orden, etiqueta
- [ ] Auditoría con `createdAt`/`updatedAt`

---

### Fase 7 — Búsqueda y filtros ⏳

**PRD fase 4** · Depende de Fases 3, 6

- [ ] Normalización: mayúsculas, espacios, guiones, `_`, puntos, barras (RF-034)
- [ ] Búsqueda por carpeta, catálogo y global con origen en resultado (RF-035–038)
- [ ] Índices PostgreSQL; debounce 250–300 ms
- [ ] `ColumnFilterService` — filtros acumulables (AND), pills, limpieza (RF-039–041)
- [ ] `GlobalFieldMapping` operativo (RF-042 parcial)

**Completitud:** `2902`, `1408`, `0193-SILVA` encuentran equivalencias; filtros acumulables operativos.

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
| RF-008 | Gestión productos | 6 | ⏳ |
| RF-009 | Edición columnas | 3/6 | 🔄 config ✅ / valores ⏳ |
| RF-010–012 | Visibilidad catálogo/carpeta/columna | 3 | ✅ |
| RF-013–016 | Subida y destino importación | 4 | ⏳ |
| RF-017 | Análisis hojas | 4 | 🔄 clasificación ✅ |
| RF-018–027 | Detección, vista previa, listas, fórmulas | 4 | ⏳ |
| RF-028–032 | Imágenes | 5 | ⏳ |
| RF-033 | Equivalencias | 6–7 | ⏳ |
| RF-034–041 | Búsqueda y filtros | 7 | ⏳ |
| RF-042 | Configuración columnas | 3 | ✅ |
| RF-043 | Archivos subidos | 8 | ⏳ |
| RF-044 | Publicación segura | 4 | ⏳ |
| RF-045–047 | Offline | 9 | ⏳ |

### 8.2 Requerimientos no funcionales (PRD §41)

- **Rendimiento:** paginación obligatoria; miniaturas en listados; índices búsqueda; progreso en importaciones; meta < 5 min a resultados relevantes.
- **Seguridad:** middleware, roles, Storage privado, MIME/ZIP seguro, URLs firmadas, `AuditLog`, ocultamiento real por rol.
- **Usabilidad API:** JSON claro, vista previa importación, informes comprensibles.
- **Compatibilidad:** Chrome/Edge/navegadores modernos; JSON para PWA.

### 8.3 Criterios de aceptación (PRD §50)

| Área | Estado |
|------|--------|
| **Base (Fase 2)** | ✅ Auth, roles, directorio, auditoría — ver [`ENDPOINTS.md`](./ENDPOINTS.md) |
| **Catálogos y carpetas** | ✅ Directorio automático, CRUD, columnas por carpeta, visibilidad, vaciado/borrar |
| **Usuarios** | ✅ Admin edita; CONSULTA solo ve. Controles UI ocultos → frontend |
| **Importación** | ⏳ |
| **Productos manuales** | ⏳ |
| **Imágenes** | ⏳ |
| **Búsqueda y filtros** | ⏳ |
| **Archivos / Offline** | ⏳ |

### 8.4 Criterios de éxito (PRD §51)

Pablo deja el pendrive; directorio automático; hojas → carpetas; búsqueda sin conocer archivo origen; equivalencias y filtros < 5 min; imágenes sin rutas locales; originales respaldados; offline tras sync; sistema comprensible para ambos locales.

### 8.5 Supuestos (PRD §52)

Pablo confirma columnas visibles/buscables/filtrables; imágenes externas con nombres originales; asociaciones pueden requerir revisión manual; fórmulas sin garantía de valor calculado; offline requiere sync previa; rol `CONSULTA` = usuario normal PRD.

---

## Referencias

- [`docs/PRD.md`](./PRD.md) · [`docs/ENDPOINTS.md`](./ENDPOINTS.md) · [`README.md`](../README.md)
