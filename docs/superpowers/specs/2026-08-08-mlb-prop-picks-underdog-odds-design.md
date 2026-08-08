# MLB Prop Picks — Underdog odds + payout under line

Date: 2026-08-08  
Status: Approved for planning  
Related: `2026-08-05-mlb-prop-picks-design.md`

## Goal

On `/mlb/prop_picks` for the **Underdog** tab, show the DFS American price and payout multiplier for the **recommended (displayed) side** under the prop line on each collapsed card.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Underdog tab only; PrizePicks unchanged |
| Side | Values for `recommended_side` (same Over/Under shown on the card) |
| Display | One muted line under `{line} {stat}`: `{american} · {payout}×` e.g. `-102 · 1.05×` |
| Schema | Extend `MlbPropDfs` with optional `american` + `payout_multiplier` |
| Source | Existing `odds.mlb_underdogs` columns (`american_price`, `payout_multiplier`) already filled by scraper |
| Missing values | Omit that part of the string; if both missing, show nothing under the line |

## Architecture

```
odds.mlb_underdogs (american_price, payout_multiplier, side)
        │
        ▼
fetch_latest_underdog  (+ SELECT payout_multiplier)
        │
        ▼
_build_board (Underdog: store per-side quote on bucket)
        │
        ▼
_assemble_rows → MlbPropDfs(line, changed_at, american, payout_multiplier)
                 from recommended_side
        │
        ▼
MlbPropPicksList card — muted secondary under line
```

## Backend

1. `fetch_latest_underdog` SELECT includes `payout_multiplier` (keep `american_price`).
2. `_build_board` for Underdog: for each offered side, store `side_quotes[side] = {american, payout_multiplier}` from the row (parse american to int; payout to float; skip invalid).
3. `_assemble_rows`: when building `dfs`, if bucket has `side_quotes[recommended]`, set those fields on `MlbPropDfs`.
4. Schema:

```python
class MlbPropDfs(BaseModel):
    line: float
    changed_at: str | None = None
    american: int | None = None
    payout_multiplier: float | None = None
```

5. OpenAPI export + `frontend` schema regen.

## Frontend

In `MlbPropPicksList` `PropPickCard`, directly under `{row.line} {row.stat}`:

- If `row.dfs.american != null` or `row.dfs.payout_multiplier != null`, render a muted (`text-white/45`) mono line.
- Format american with existing `formatAmericanOdds`.
- Format payout as fixed 2 decimals + `×` (e.g. `1.05×`).
- Join with ` · ` when both present.
- PrizePicks (null fields) shows no extra line.

## Tests

- Backend: Underdog board assembles `dfs.american` / `dfs.payout_multiplier` for the recommended side; PrizePicks leaves them null.
- Frontend: card shows `-102 · 1.05×` under the line when `dfs` has both; hides when both null.

## Out of scope

- PrizePicks prices
- Expanded-panel book cells
- Changing recommended-side logic
- WNBA prop picks

## Success criteria

1. Underdog tab cards show American + payout under the prop line for the displayed side when snapshot data exists.
2. PrizePicks tab layout unchanged.
3. Unit tests pass; OpenAPI types updated.
