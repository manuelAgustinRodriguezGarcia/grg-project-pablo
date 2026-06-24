# Fase 7 — Búsqueda y filtros — Plan ejecutado

> Implementado 2026-06-24. Referencia viva: [`AGENT-BRIEF.md`](../../AGENT-BRIEF.md)

## Entregables

- `src/server/search/` — normalización, config resolver, SearchService
- `src/server/filters/` — ColumnFilterService (AND, pills)
- `GlobalField` + migración `20260624220000_phase7_search_indexes`
- REST: products `q`/`filters`, `catalogs/{id}/search`, `search/global`
- Import: `indexedText` vía `buildIndexedTextForMappedProduct`
- Script: `scripts/reindex-folder-products.ts`
- Tests: 243 passing

## Verificación

```bash
pnpm test:run && pnpm db:verify && pnpm storage:verify
```
