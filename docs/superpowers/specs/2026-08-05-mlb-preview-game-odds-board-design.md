# MLB Preview game odds board (team perspective)

Date: 2026-08-05  
Status: Approved for planning

## Goal

On `/mlb/games/:gamePk` **Preview**, show a right-rail **Odds** board with moneyline, over/under, and run line **from each team’s perspective** (American prices), beside projected RotoWire lineups. Reuse `GET /api/mlb/odds/today` with an additive nested `board` so `/mlb/matchups` stays unchanged.

Open column and manual Refresh are out of scope for v1.

## Decisions

| Topic | Choice |
| --- | --- |
| Markets | Moneyline + O/U + run line with American prices; no Open column |
| Layout | `lg+` two-column: lineups left, odds right; Team Stats + Injuries full-width below |
| Mobile | Lineups → odds → Team Stats → Injuries |
| Source | Pinnacle first (`odds.mlb_pinnacle_team`); Sharp fallback for flat RL/total when Pinnacle empty for that game (same rule as matchups) |
| Moneyline | Pinnacle only; Sharp does not supply ML on this path |
| API | Extend `GET /api/mlb/odds/today` — keep flat matchup fields; add optional nested `board` |
| Matchups UI | Unchanged; ignore `board` |
| Header | “Odds” + sportsbook label + as-of; no Refresh control |
| Period filter | Main FG only: `period=0`, `is_alternate=false` |
| Total sides | Away row = Over; home row = Under |
| Row order | Away then home |
| Out of scope | Open lines, Refresh, Prop Picks, matchups card redesign, opening-line history |

## Architecture

```
odds.mlb_pinnacle_team (+ Sharp run_line/total_runs fallback)
        ↓
GET /api/mlb/odds/today
  MlbOddsGame:
    existing: spread_team_abbrev, spread_line, total, sportsbook, game_date, …
    + board: { away, home } | null
        ↓
Preview: useMlbOdds → match by away@home + gameDate
  → MlbGameOddsBoard (right of Projected Lineups)
Matchups: mergeMatchupOdds uses flat fields only
```

## Data model

### `MlbOddsBoardSide` (new)

- `moneyline: int | null` — American price for that team
- `spread: { line: float, price: int | null } | null` — that team’s run line + price
- `total: { side: "over" | "under", line: float, price: int | null } | null`

### `MlbOddsGame` (extended)

- Keep existing flat fields for matchups cards.
- Add `board: { away: MlbOddsBoardSide, home: MlbOddsBoardSide } | null`.
- Pinnacle normalize populates both flat favorite-style spread/total **and** `board` when priced FG sides exist.
- Sharp-only rows: flat fields as today; `board` is **null** (Sharp matchup path has no ML/prices). Preview UI may still show RL/total **lines** derived from flat fields with `–` for prices and moneyline.

## Backend

- Extend `schemas_odds.py` with board side models; regenerate OpenAPI / frontend schema as usual.
- Update `normalize_pinnacle_team_rows` to collect moneyline + both-side spread/total with `american_price` for `period=0` / non-alternate.
- Preserve existing Pinnacle-prefer / Sharp-when-empty merge for flat fields.
- When merging, prefer Pinnacle game (including its `board`) over Sharp for that matchup key.

## Frontend

- New `MlbGameOddsBoard` in `frontend/src/features/mlb/game/`:
  - Header: Odds · sportsbook · as-of
  - Two rows (away, home): logo + abbrev + three tiles (Money, O/U, RL)
  - Missing market → `–`; no match / empty board → “Odds unavailable”
- Restructure Preview stack (in `MlbProjectedLineups` or `MlbPregameCenter`) to `lg` two-column grid for lineups | odds; keep Team Stats + Injuries below full width.
- `useMlbOdds` on Preview; match game with same abbrev + `game_date` rules as matchups (`mergeMatchupOdds` / shared helper).
- Small formatter helpers + unit tests for American odds and `o`/`u` labels.
- Update `md/system-design.md` Preview row: odds board via `/api/mlb/odds/today`.

## Error handling

- Odds fetch error or empty slate → “Odds unavailable”; lineups still render.
- Matched game with `board` null (Sharp-only) → show RL/total **lines** from flat fields when present; moneyline and prices as `–`. If no flat markets either → “Odds unavailable”.
- Matched game with partial `board` → show present tiles; `–` for missing markets.
- Doubleheader abbrev collision → first date + away@home match (same limitation as lineups).
- Do not invent prices or Open lines.

## Testing

- Backend: Pinnacle normalize builds `board` with ML + both-side RL/total prices; junk skipped; Sharp flat fallback; merge prefers Pinnacle board when present.
- Frontend: formatters; board two rows / three tiles; unavailable state; Preview places board beside lineups on wide layout.
- Docs: system-design Preview ↔ API table updated.

## Success criteria

1. Preview right rail shows Money / O-U / RL with prices per team when Pinnacle (or priced board) data matches the game.
2. Header shows sportsbook + as-of; no Refresh; no Open column.
3. `/mlb/matchups` cards behave as today (flat spread/total only).
4. Missing odds degrade to unavailable / `–` without breaking lineups, Team Stats, or Injuries.
)