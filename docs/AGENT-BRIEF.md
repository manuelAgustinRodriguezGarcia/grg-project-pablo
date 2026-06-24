# AGENT-BRIEF — Contexto compacto backend

> Entrada rápida para agentes. Detalle completo: [`ENDPOINTS.md`](./ENDPOINTS.md) · [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) · [`PRD.md`](./PRD.md)

**Última actualización:** 2026-06-24 · **Fases backend completas:** 1–7 (pendiente UI en varias áreas)

---

## Roadmap

| Fase | Área | Estado |
|------|------|--------|
| 2 | Auth, usuarios, auditoría | ✅ |
| 3 | Catálogos, carpetas, columnas | ✅ |
| 4 | Importación Excel | ✅ backend |
| 5 | Imágenes producto | ✅ backend |
| 6 | CRUD productos, equivalencias, ayuda columnas | ✅ backend |
| 7 | Búsqueda y filtros | ✅ backend |
| 8 | Listado archivos subidos | ⏳ |
| 9 | Offline sync | ⏳ |
| 10 | Pruebas reales + deploy | ⏳ |

---

## Servicios clave

| Servicio | Ruta | Rol |
|----------|------|-----|
| `SearchService` | `src/server/search/search.service.ts` | Búsqueda carpeta/catálogo/global |
| `ColumnFilterService` | `src/server/filters/column-filter.service.ts` | Filtros AND + pills |
| `ProductService` | `src/server/services/product.service.ts` | Listado con `q` + `filters` |
| `GlobalFieldService` | `src/server/services/global-field.service.ts` | Registry campos globales |
| `VisibilityService` | `src/server/services/visibility.service.ts` | Rol `CONSULTA` → 404 en ocultos |

---

## APIs Fase 7 (búsqueda/filtros)

| Método | Ruta | Query principal |
|--------|------|-----------------|
| GET | `/api/admin/folders/{folderId}/products` | `page`, `pageSize`, `q`, `filters` (JSON) |
| GET | `/api/admin/catalogs/{catalogId}/search` | `q`, `page`, `pageSize` |
| GET | `/api/admin/search/global` | `q`, `catalogId?`, `folderId?`, `globalFieldKey?`, `globalFieldValue?` |

**UX:** debounce 250–300 ms en cliente al escribir en buscador/filtros (solo frontend).

**Normalización:** `normalizeSearchTerm` — ignora mayúsculas, espacios, `-`, `_`, `.`, `/` (RF-034).

**Indexación:** `Product.indexedText` + `EquivalentCode.normalizedCode`; import usa `buildIndexedTextForMappedProduct`.

**Backfill:** `pnpm dlx tsx scripts/reindex-folder-products.ts <folderId>`

---

## Modelos nuevos Fase 7

- `GlobalField` — seeds: `brand`, `category`, `manufacturer`, `application`, `model`
- Mapeo columna ↔ global: `FolderColumn.globalFieldKey` (validado en `ColumnConfigService`)
- Índices: `pg_trgm` GIN en `Product.indexedText`, `Product.description`

---

## Convenciones API

- Auth: cookies Supabase; `/api/admin/*` requiere sesión
- Roles: `ADMIN` | `CONSULTA`
- Errores JSON: `{ error, code? }`
- Server Actions: `{ success, data? }` | `{ success: false, error, code? }`

---

## Verificación local

```bash
pnpm lint && pnpm test:run && pnpm db:verify && pnpm storage:verify
```

Migración Fase 7: `20260624220000_phase7_search_indexes`
