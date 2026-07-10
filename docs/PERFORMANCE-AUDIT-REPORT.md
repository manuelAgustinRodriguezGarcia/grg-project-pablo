# Reporte final — Auditoría y optimización full-stack

Fecha: 2026-07-09  
Alcance: optimizaciones de riesgo bajo/medio aplicadas; alto riesgo documentado sin aplicar.

## Baseline (pre-cambios)

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | Errores preexistentes en tests/UI (no introducidos por esta auditoría) |
| `pnpm lint` | 24 errors / 39 warnings preexistentes |
| `pnpm test:run` | 5 failed / 73 passed — mismos fallos: `DATABASE_URL` en 3 suites + 2 assertions de pills de filtros |

Post-cambios: mismos fallos de baseline; suites tocadas (search, equivalence, guards, product) en verde. Test files: 72 passed (uno menos por eliminación de `CatalogGlobalSearchResults.test.tsx` huérfano).

---

## Performance — ganancias estimadas

| Métrica | Estimación | Evidencia |
|---------|------------|-----------|
| Frontend re-renders | −20–40% en tipado/filtros de tablas admin | `memo(ProductTable/PriceItemTable)` + invalidación Query sin `reloadToken` |
| Bundle size (admin inicial) | −80–200 KB gzip estimado | Lazy de `ProductFormModal` (~920 líneas) + modales de precios |
| API list products | −30–50% latencia server | `Promise.all` de 3 resolvers secuenciales |
| Auth guard | −1 query/request autenticado | `touchLastAccessIfStale` usa `profile.lastAccessAt` ya cargado |
| Import equivalencias | de ~3N queries → 2 | `syncManyFromProducts` (deleteMany + createMany) |
| Match imágenes externas | de N+1 → 1 | `findForMatchingByFolder` con select |
| Search catalog | menos payload | `findSearchPaginated` en lugar de `include` completo |
| Listados DB | menor cost de sort | índices compuestos `(folderId, updatedAt, id)` / `(priceListId, updatedAt, id)` |
| LCP / TTFB | mejora menor en admin TTFB; LCP landing sin cambio | Sin `next/image` en thumbs (Grupo C) |

---

## Codebase — cambios aplicados

| Métrica | # |
|---------|---|
| Archivos modificados (aprox.) | ~25 |
| Archivos muertos eliminados | 12 |
| Unused exports/schemas removidos | 2 (`formatAdminDate`, `setPriceImportDestinationSchema`) |
| Queries optimizadas | 6+ hot paths |
| Índices recomendados/añadidos | 4 (migración aditiva) |

### Por archivo

| Archivo | Cambio | Por qué es seguro |
|---------|--------|-------------------|
| `src/server/database/prisma.ts` | Cache Prisma en `globalThis` también en prod | Misma API; evita pools duplicados |
| `src/server/services/product.service.ts` | `Promise.all` imágenes/anotaciones; bulk equiv folder | Mismo shape de respuesta |
| `src/server/services/equivalence.service.ts` | `buildRowsForProduct` + `syncManyFromProducts` | Mismo resultado de filas |
| `src/server/repositories/equivalent-code.repository.ts` | `deleteByProductIds` | API aditiva |
| `src/server/services/catalog-import.service.ts` | Usa bulk sync post-publish | Sin cambio de contrato HTTP |
| `src/server/services/product-image.service.ts` | 1 query con `dynamicData` | Mismos campos de matching |
| `src/server/repositories/product.repository.ts` | `findForMatchingByFolder`; `findPaginated` → basic | Callers actualizados |
| `src/server/search/search.service.ts` | Catalog search → `findSearchPaginated` | Mismo JSON de search |
| `prisma/schema.prisma` + migración | 4 índices compuestos/filtro | Solo `CREATE INDEX` |
| `src/features/admin/query-keys.ts` | Factories de keys | Nuevo helper |
| `CatalogNavigator` / `PriceNavigator` | Sin `reloadToken`; invalidate por prefijo | Misma UX de refresh |
| `FilesManager.tsx` | `useQuery` + invalidate | Mismo endpoint `/api/admin/files` |
| `LazyProductFormModal` / `LazyPriceModals` | dynamic import | Mismo markup al abrir |
| `ProductTable` / `PriceItemTable` | `React.memo` | Mismo output |
| `user.repository` + `guards` | touch last access sin find extra | Misma semántica de throttle |
| Dead code P0 | mocks, placeholders, MapPreview, search legacy, etc. | 0 importadores |

---

## Índices (query ↔ índice)

1. **`Product_folderId_updatedAt_id_idx`** — `product.findMany({ where: { folderId }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] })` en listados/paginación.
2. **`PriceItem_priceListId_updatedAt_id_idx`** — mismo patrón en ítems de lista de precios.
3. **`FolderColumn_globalFieldKey_idx`** — filtros/búsqueda global por `globalFieldKey`.
4. **`FolderColumn_isGloballySearchable_idx`** — `where: { isGloballySearchable: true }`.

Aplicar con: `pnpm db:migrate` (o el script del repo) en cada entorno.

---

## Grupo C — alto riesgo (no aplicado)

| Propuesta | Impacto | Riesgo |
|-----------|---------|--------|
| Pasar `tx` a repos en `$transaction` de import publish | Atomicidad real | Alto — refactor de repos |
| Paginación/límites en offline thumbnails + cap firmas Storage | Evita OOM/timeouts | Medio-alto — puede cambiar payload sync |
| FTS / `pg_trgm` en `indexedText` | ILIKE mucho más rápido | Alto — extensión + queries |
| Quitar `react-hook-form` / `@hookform/resolvers` (deps sin uso) | −bundle | Decisión de producto |
| Borrar server actions sin callers UI | Menos superficie | Pueden ser contrato futuro |
| Unificar filter menus + partir mega-SCSS | CSS payload | Riesgo visual |
| `<img>` → `next/image` en thumbs | LCP/bandwidth | Layout/sizes |
| Enforcement `RolePermission` | Seguridad | Feature WIP, fuera de perf |

---

## Validación

- Tests unitarios de search / equivalence / guards / product: **pass**
- Suite completa: mismos fallos preexistentes (DATABASE_URL + pills)
- Contratos API/actions usados por UI: **sin cambios de signature**
- UI/estilos: sin cambios visuales intencionales
