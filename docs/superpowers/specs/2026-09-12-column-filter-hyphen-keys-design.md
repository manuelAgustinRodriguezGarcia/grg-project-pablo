# Column filter hyphen keys

## Goal

Make column filters work for every dynamic column whose `internalKey` contains a hyphen (e.g. `sub-rubro`), and stop generating hyphenated keys on future imports.

## Problem

Filtering a TEXT dynamic column runs through `findIdsMatchingJsonTextFilters`, which rejects keys that do not match `/^[a-zA-Z0-9_]+$/`.

Excel headers such as `SUB-RUBRO` were slugified to `sub-rubro`. Filtering that column (e.g. contains `"SERIE"`) throws `Clave de columna inválida: sub-rubro` before the SQL `ILIKE` runs. The query itself is correct: `%SERIE%` matches values like `SERIE 6000`.

Affected existing keys include at least: `sub-rubro`, `conjunto_piston-perno-aro`, `rosca_izq_-_der`, `tornillos_principales_1_-_2`, `voltaje_12v_-_24v`, `voltaje_12v-24v`.

## Scope

- Catalog product JSON text filters (`product.repository`).
- Price-list JSON text filters (`price-item.repository`) — same validation pattern.
- Future header slugification (`column-mapper.ts` `slugifyHeader`).
- Unit tests for validation allowance and new slugify behavior.

Out of scope:

- Migrating existing `internalKey` values or `dynamicData` keys.
- UI changes to the column filter popover.
- Changing filter operators or `contains`/`equals` SQL semantics.

## Decisions

1. **Allow hyphens in filter key validation** so existing hyphenated keys keep working.
2. **Normalize hyphens to underscores in new slugified keys** so future imports do not create the same class of keys.
3. **Do not migrate existing data.** Re-imports of existing folders continue to match columns by `originalName` first, so existing `sub-rubro` keys remain as-is.

## Backend changes

### Shared / duplicated key validation

Update `VALID_JSON_COLUMN_KEY` in:

- `src/server/repositories/product.repository.ts`
- `src/server/repositories/price-item.repository.ts`

From roughly `/^[a-zA-Z0-9_]+$/` / `/^[a-z0-9_]+$/` to a pattern that also allows `-`, e.g. `/^[a-zA-Z0-9_-]+$/`.

Prefer extracting one shared constant if there is already a natural shared filters/utils module; otherwise update both call sites to the same pattern.

Keys remain Prisma-bound parameters (`"dynamicData"->>$n`), not interpolated SQL identifiers, so allowing `-` does not open identifier injection.

### Import slugify

In `src/server/importers/column-mapper.ts` `slugifyHeader`:

- Treat `-` like whitespace: replace with `_`.
- Keep collapsing repeated `_` and trimming leading/trailing `_`.

Examples:

| Header | Before | After |
| --- | --- | --- |
| `SUB-RUBRO` | `sub-rubro` | `sub_rubro` |
| `12V - 24V` | `12v_-_24v` | `12v_24v` |
| `NÚMERO` | `numero` | `numero` (unchanged) |

`mapHeadersToFolderColumns` already prefers `originalName` match over `internalKey`, so re-import of folders that already have `sub-rubro` continues to bind to the existing column.

## Tests

- Repository / filter path: a hyphenated `columnInternalKey` such as `sub-rubro` is accepted by the key validator (or end-to-end `findIdsMatchingJsonTextFilters` no longer throws for that key). Reject still applies for unsafe characters (spaces, quotes, etc.).
- `headerToInternalKey` / slugify: `SUB-RUBRO` → `sub_rubro`; consecutive hyphen/space runs collapse to a single `_`.

## Error handling

- Invalid keys (characters outside `[a-zA-Z0-9_-]`) continue to throw the existing invalid-key error.
- No new user-facing error messages.

## Success criteria

- Filtering `SUB-RUBRO` with contains `"SERIE"` in RODAMIENTOS → RULEMANES returns the SERIE\* products instead of failing.
- The same filter path works for any existing hyphenated `internalKey` in catalogs and price lists.
- Newly detected headers with hyphens get underscore-only keys.
