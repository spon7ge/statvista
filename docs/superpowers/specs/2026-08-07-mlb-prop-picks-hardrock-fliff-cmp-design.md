# MLB Prop Picks — Hard Rock & Fliff comparison books

Date: 2026-08-07  
Status: Implemented

> **Note (2026-08-08):** [Soft Consensus](2026-08-08-mlb-prop-picks-soft-consensus-design.md) supersedes “cmp never sets fair” when Tier 1/2 are empty — Hard Rock/Fliff (and other soft books) can contribute to Tier 3 fair; expand cells still use `role: "comparison"`.

## Goal

On `/mlb/prop_picks` expand, show Hard Rock and Fliff quotes from ParlayAPI as **comparison-only** cells (same treatment as Caesars / Fanatics / Pinnacle). They never enter fair %, edge, or source-tier logic.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB prop picks expand only |
| Role | Both `role: "comparison"` (show `(cmp)` badge) |
| Fair stack | Unchanged — Tier 1 PX+Novig → Tier 2 DK+FD → No Sharp Read |
| Line match | Exact DFS line only (existing `_book_quote` / index key) |
| Parlay fetch | Keep unfiltered props GET; client-side keeplist |
| Parlay keys | `hardrock`, `fliff` (per Parlay docs) |
| Display order | After Fanatics: Hard Rock, then Fliff |
| Out of scope | Fair/edge changes, WNBA columns, dedicated scrapers |

## Data model

Extend `MlbPropBooks` with:

- `hardrock: MlbPropBookQuote | None`
- `fliff: MlbPropBookQuote | None`

`MlbPropBookQuote` unchanged (`side`, `fair_pct`, `american`, `changed_at`, `role`).

### Backend indexing (`backend/app/domains/mlb/props.py`)

- Keep `_PARLAY_FAIR_BOOKS` unchanged.
- Extend `_PARLAY_CMP_BOOKS` to include `"hardrock"`, `"fliff"` (after existing five).
- `_index_parlay` continues to index the union of fair + cmp books.
- When building `MlbPropBooks`, attach both with `role="comparison"` via existing `_cmp_quote`.
- `_fair_driving_changed_at` / `compute_fair` callers unchanged.

### Timestamps

Parlay `changed_at` remains request-time approximation (existing v1 limitation). Expand hover tooltip continues to use `changed_at` with board `lastUpdatedAt` fallback.

## UI

Expand book cell order:

1. ProphetX  
2. Novig  
3. DraftKings  
4. FanDuel  
5. Pinnacle (cmp)  
6. Caesars (cmp)  
7. Kalshi (cmp)  
8. bet365 (cmp)  
9. BetMGM (cmp)  
10. Fanatics (cmp)  
11. Hard Rock (cmp)  
12. Fliff (cmp)

Keep existing expand grid: `grid-cols-2 sm:grid-cols-3`. Labels in `BOOK_LABELS` (`hardrock` → Hard Rock, `fliff` → Fliff). Missing quote → “No line” (no tooltip).

## Contract / types

- Update OpenAPI golden + `frontend/openapi.json`
- Regenerate `frontend/src/shared/lib/api.schema.d.ts`
- Verify with `npm run check:api` (frontend)

## Testing

**Backend** (`test_mlb_props.py` or equivalent):

- Parlay rows for `hardrock` / `fliff` at the DFS line appear on the row with `role == "comparison"`.
- Presence of only these cmp books (no PX/Novig/DK/FD) still yields `no_sharp_read` / no fair from those books.

**Frontend** (`MlbPropPicksList.test.tsx`):

- Expand shows Hard Rock / Fliff labels.
- `(cmp)` badge present when quote has `role: "comparison"`.

## Success criteria

- Expand shows up to twelve book cells in the order above.
- Hard Rock and Fliff never move fair/edge/tier.
- OpenAPI + frontend types in sync.
- WNBA prop picks behavior unchanged.
