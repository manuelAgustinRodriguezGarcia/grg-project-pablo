# BACKEND-IMPLEMENTATION — Plan de implementación backend

> Derivado de [`PRD.md`](./PRD.md). **API:** [`ENDPOINTS.md`](./ENDPOINTS.md) · **Import:** [`METHOD-IMPORT.md`](./METHOD-IMPORT.md) · **Schema:** [`prisma/schema.prisma`](../prisma/schema.prisma)

---

## 1. Estado actual

**Rama:** `backend` · **Completado:** Fases 1–9 + Precios · **Pendiente:** Fase 10

| Fase PRD (§48) | Fase backend | Estado |
|----------------|--------------|--------|
| 1 — Base visual y acceso | 2 | ✅ |
| 2 — Catálogo-Carpeta-Producto | 3 | ✅ |
| 3 — Administración manual | 6 | ✅ |
| 4 — Filtros y búsqueda | 7 | ✅ |
| 5 — Importador | 4 | ✅ |
| 6 — Imágenes | 5 | ✅ |
| 7 — Archivos subidos | 8 | ✅ |
| 8 — Offline | 9 | ✅ |
| 9 — Pruebas y entrega | 10 | ⏳ |
| — | 1 — Análisis | ✅ |

| Área | Resumen |
|------|---------|
| **Stack** | Next.js 16, React 19, TypeScript, Prisma 7, Supabase Auth + Storage |
| **Modelos** | `User`, `Catalog`, `CatalogFolder`, `FolderColumn`, `Product`, `EquivalentCode`, `ProductImage`, `UploadedFile`, `ImportJob` (+ sheets/preview), `GlobalField`, `PriceList`/`PriceColumn`/`PriceItem`, `OfflineSyncManifest`, `AuditLog` |
| **Servicios** | Auth, Users, Catalog, Folder, Column, Product, Equivalence, Visibility, Navigation, Directory, ExcelStructure, Audit, CatalogImport, Image*, Search, ColumnFilter, GlobalField, UploadedFile, Price*, OfflineSync |
| **Pendiente backend** | Fase 10 (pruebas, despliegue, RF-004 dominio) |
| **Pendiente UI** | Integración frontend (`/admin/precios`, PWA offline, formularios, buscador, importador, etc.) |

**Glosario:** Carpeta = `CatalogFolder` · Producto = `Product` · Usuario normal = `CONSULTA` · Admin = `ADMIN`

---

## 2. Contexto y arquitectura

**Dominio:** `Catálogo → Carpeta (hoja Excel) → Producto (fila)`

**Principios:** columnas/filtros/imágenes por carpeta (JSONB); Excel original en Storage; visibilidad real por rol; backend en Next.js (Route Handlers + Actions + Services + Repositories); sin NestJS, macros VBA ni tablas físicas por Excel.

```text
src/app/          → (public), auth/, admin/, api/admin/
src/features/     → schemas Zod, actions, tipos
src/server/       → services, repositories, importers, image-processors, search/, filters/
```

**Stack:** PostgreSQL + JSONB · Prisma 7 · Supabase Auth/Storage · ExcelJS · sharp/unzipper · Zod

---

## 3. Modelo de datos

Definición canónica: `prisma/schema.prisma`. Migración reciente: `20260625194831_price_lists_and_offline_sync`.

| Entidad | Fase | Notas |
|---------|------|-------|
| `User`, `Catalog`, `AuditLog` | 2 | Auth Supabase |
| `CatalogFolder`, `FolderColumn`, `Product` | 3 | `searchConfig`/`filterConfig` JSON |
| `UploadedFile`, `ImportJob`, `ImportSheet`, `ImportPreview` | 4 | Publicación segura |
| `ProductImage` | 5 | Estados §27 PRD |
| `EquivalentCode` | 6 | Búsqueda normalizada |
| `GlobalField` | 7 | Mapeo vía `FolderColumn.globalFieldKey` |
| `PriceList`, `PriceColumn`, `PriceItem` | Precios | Independiente de catálogos |
| `OfflineSyncManifest` | 9 | Por usuario/dispositivo |

**Importación:** flujo y estados en [`METHOD-IMPORT.md`](./METHOD-IMPORT.md). Destinos: carpeta de catálogo o `PRICE_LIST`.

---

## 4. Fases completadas ✅

Resumen compacto. Contratos API: [`ENDPOINTS.md`](./ENDPOINTS.md).

| Fase | Fecha | Entregables clave | RF principales |
|------|-------|-------------------|----------------|
| **1** Análisis | — | Dominio Rulemanes, Catálogo Azul, Embragues | — |
| **2** Base | 2026-06-18 | DB, Storage, Auth, Users, Directory, Audit | RF-001–003 |
| **3** Catálogos | 2026-06-19 | CRUD catálogos/carpetas/columnas, productos lectura, visibilidad, navegación | RF-005–012, RF-042, RF-048–049 |
| **4** Importador | 2026-06-22 | Asistente 6 pasos, ExcelJS, combinar/reemplazar, respaldo Storage | RF-013–027, RF-044 |
| **5** Imágenes | 2026-06-23 | Extracción embebida/externa, matching, miniaturas, revisión | RF-028–032 |
| **6** Admin manual | 2026-06-24 | CRUD productos, equivalencias, imágenes manuales, ayuda contextual columnas | RF-008, RF-033, RF-050–052 |
| **7** Búsqueda | 2026-06-24 | SearchService, filtros acumulables, GlobalField, índices GIN | RF-034–041 |
| **8** Archivos | 2026-06-25 | Listado, descarga, informe, reproceso, eliminación Excel | RF-043 |
| **Precios** | 2026-06-25 | Listas, columnas, ítems, import `PRICE_LIST` | RF-053–059 |
| **9** Offline | 2026-06-25 | Manifest versionado, bundles chunked, thumbnails | RF-045–047 |

**Verificación habitual:** `pnpm lint` · `pnpm test:run` · `pnpm db:verify` · `pnpm storage:verify`

---

## 5. Requerimientos (resumen)

| ID | Requerimiento | Estado |
|----|---------------|--------|
| RF-001–003 | Auth, roles, landing | ✅ |
| RF-004 | Dominio producción | ⏳ Fase 10 |
| RF-005–012 | Estructura y visibilidad | ✅ |
| RF-013–027 | Importación catálogos | ✅ |
| RF-028–032 | Imágenes | ✅ backend · ⏳ UI modal |
| RF-033 | Equivalencias | ✅ |
| RF-034–041 | Búsqueda y filtros | ✅ backend · ⏳ UI |
| RF-042–044 | Columnas, archivos, publicación segura | ✅ |
| RF-045–047 | Offline | ✅ backend · ⏳ PWA |
| RF-048–052 | Nombres columnas, ayuda contextual | ✅ backend · ⏳ UI |
| RF-053–059 | Precios | ✅ backend · ⏳ UI |

**No MVP (PRD §49):** macros, edición Excel web, OCR/IA, multiempresa, facturación/stock, NestJS.

---

## 6. Fase 10 — Pruebas y entrega ⏳

**PRD fase 9** · Depende de todas las fases anteriores

### 6.1 Objetivos

Validar el sistema con archivos reales de Pablo, medir rendimiento, cerrar seguridad y desplegar a producción con documentación operativa.

### 6.2 Checklist

- [ ] **Archivos reales (PRD §50):** Rulemanes, Catálogo Azul, Embragues — importación completa, imágenes, equivalencias, búsquedas representativas (`2902`, `1408`, `0193-SILVA`)
- [ ] **Rendimiento:** paginación bajo carga; progreso visible en importaciones largas; búsquedas indexadas < 5 min a resultados relevantes
- [ ] **Seguridad:** Storage privado; ZIP seguro; ocultamiento real por rol `CONSULTA`; rate limits login/import; URLs firmadas con expiración
- [ ] **Despliegue:** `www.rothamelrepuestos.com.ar` · `NEXT_PUBLIC_APP_URL` · `prisma migrate deploy` en CI/CD · variables Supabase
- [ ] **Documentación operativa:** guía para Pablo (importar, reimportar, revisar imágenes, gestionar usuarios) + runbook recuperación

### 6.3 Criterios de éxito (PRD §51)

Pablo deja el pendrive; directorio automático; hojas → carpetas; búsqueda sin conocer archivo origen; equivalencias y filtros operativos; imágenes sin rutas locales; originales respaldados; offline tras sync; sistema comprensible para ambos locales.

### 6.4 Supuestos (PRD §52)

Pablo confirma columnas visibles/buscables/filtrables; imágenes externas con nombres originales; asociaciones pueden requerir revisión manual; fórmulas sin garantía de valor calculado; offline requiere sync previa.

---

## FEATURES

<!-- Apartado reservado para features futuras documentadas fuera del plan por fases. -->

---

## Referencias

- [`docs/PRD.md`](./PRD.md) · [`docs/ENDPOINTS.md`](./ENDPOINTS.md) · [`docs/METHOD-IMPORT.md`](./METHOD-IMPORT.md) · [`README.md`](../README.md)
