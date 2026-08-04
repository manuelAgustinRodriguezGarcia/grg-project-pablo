# Number column range filter

## Goal

Allow filtering NUMBER columns by an inclusive numeric range from the column filter popover, with a distinct green active-filter pill. Single-value filtering keeps the existing blue/celeste behavior.

## Scope

- Only columns with `dataType === "NUMBER"`.
- Catalog product table column filters (`ColumnFilterMenu`, `ActiveFilterPills`, `ColumnFilterService`, related schemas/types).
- Out of scope: TEXT columns, price-list filters (unless they already share the same `ColumnFilterInput` path and get `between` for free via shared types — do not specially build price UI for this).

## Decisions

- Model: extend `ColumnFilterOperator` with `"between"`.
- Payload: `{ columnInternalKey, operator: "between", value: "min|max" }` with min ≤ max after normalization.
- Range semantics: inclusive on both ends (`min ≤ cellValue ≤ max`), supporting decimals in stored values and in inputs (e.g. `105`–`107` matches `106.36`, `106.4`, `107`; excludes `104.9` and `107.1`).
- If the user enters a larger first value than the second, swap automatically before applying (e.g. `200` + `100` → `100|200`).
- Range applies only when both inputs are filled **and** the user presses the search button.
- Search button is disabled when either input is empty, or when the first input is not a pure number (letters/invalid numeric text).
- Filling only the second input does nothing.
- Filling only the first input keeps current debounce/single-value search (blue pill, quoted label).
- Focusing the second input after typing in the first cancels the pending first-input debounce and starts a 2s wait:
  - If the user types in the second input within that window (or anytime while intending range): do **not** auto-apply; wait for the search button.
  - If the user does not type in the second input within 2s: apply the first input as a normal single-value filter (blue pill, no range dash).
- Placeholders:
  - Input 1: `Filtrar {nombre columna}` (existing formatter, column name lowercased).
  - Input 2: `Segundo valor del rango`.
- Search button: celeste/blue background; action runs only on press (when enabled).
- Active filter pills:
  - `contains` / `equals`: existing blue/celeste style; label `COLUMNA: "valor"`.
  - `between`: green style; label `COLUMNA: min - max` (no quotes around the range).

## UI behavior (`ColumnFilterMenu`)

For NUMBER columns only, below the existing filter input:

1. First text input — draft single value / range start (existing operators Contiene / Igual a still apply to single-value mode).
2. Second text input + search button (button inside/aligned to the right of the second field).

Commit rules:

| State | Result |
| --- | --- |
| Only input 1 filled | Debounced/Enter/close → single filter (`equals`/`contains`) |
| Only input 2 filled | No filter change |
| Both filled, no button press | No range filter; first-input debounce suppressed while range intent is active |
| Both filled + search click | `between` with normalized `min\|max` |
| Input 1 non-numeric | Range button stays disabled; single-value path may still run for text contains/equals as today |

Reopening the menu with an active filter:

- `between` → input 1 = min, input 2 = max, operator UI remains available for switching back to single-value editing.
- `equals` / `contains` → input 1 = value, input 2 empty.

## Data & backend

### Types / schemas

- `ColumnFilterOperator`: `"contains" | "equals" | "between"`.
- Zod (`columnFilterInputSchema` and server `columnFilterSchema`): allow `between`; value must match two parseable numbers separated by `|` when operator is `between`.
- Reject `between` on non-NUMBER columns in `validateFiltersForColumns` (or equivalent).

### Query building (`ColumnFilterService.buildFilterWhere` / `buildDynamicDataCondition`)

- For NUMBER + `between`: parse `min`/`max` from `value`, ensure min ≤ max, apply inclusive bounds on `dynamicData` path (Prisma JSON `gte`/`lte` or equivalent that correctly compares numeric JSON values including decimals).
- Primary-code / description columns are not the target for this feature; if a NUMBER dynamic column is primary/description edge case, prefer dynamicData path used for NUMBER equals today.

### Pills

- Client `toActiveFilterPillsFromState` and server `toActiveFilterPills`:
  - `between` → `label: \`${displayName}: ${min} - ${max}\``, plus a flag or derive green styling from `operator === "between"`.
- `ActiveFilterPills`: apply green class when `operator === "between"`; keep existing remove/clear-all behavior (one filter per column via `upsertColumnFilter`).

## Error handling

- Invalid `between` payload from API → validation error (same pattern as other filter validation).
- Non-numeric first input → cannot enable range search (UI); no special toast required.
- Empty second-only → no-op (no error).

## Testing

- Unit: parse/normalize `between` value (swap when inverted); reject non-numeric / bad shape; pill label formatting; green vs blue operator distinction in pill mapping.
- Unit/service: NUMBER range inclusive matches decimals between bounds; excludes outside bounds.
- Component: `ColumnFilterMenu` — button disabled states; range only on button; focus-second-input 2s fallback to single value; only-second no-op; letter in first disables range.

## Implementation notes

- Touch: `column-filter.types.ts`, catalog + server filter schemas, `column-filter.service.ts`, `column-filter-state.ts`, `ColumnFilterMenu.tsx` (+ styles), `ActiveFilterPills.tsx` (+ green pill style), existing unit/component tests.
- Preserve existing 2.5s debounce for single-value input 1 when range intent is not active.
- Do not invent a separate filter id; still one filter entry per `columnInternalKey`.
