# MLB Matchup Prediction (Preview)

Date: 2026-08-07  
Status: Implemented

## Goal

Add a **Matchup prediction** card on MLB game Preview under Game Info on the right rail only — same ESPN win-% idea as WNBA scheduled preview, styled like MLB Game Info / odds (`GameSection`, 18px title). Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Preview only (not Live / Final / Box / halftime) |
| Placement | Right column under `MlbGameInfo` (Odds → Game Info → Matchup prediction) |
| Approach | Extend existing ESPN summary enrichment (Approach 1) — no new HTTP call |
| Missing predictor | Hide card (`null`); never fail game detail |
| Chrome | MLB charcoal `GameSection` + 18px heading; team-color split bar like WNBA |
| Source label | `ESPN game projection` |
| Data | ESPN summary `predictor.awayTeam/homeTeam.gameProjection` |

## Architecture

```
MlbGameDetailPage (scheduled)
  └── MlbPregameCenter → MlbProjectedLineups
        right column:
          MlbGameOddsBoard
          MlbGameInfo
          MlbMatchupPrediction   ← new (null → render nothing)

GET /api/mlb/games/{gamePk}
  └── _attach_espn_summary_enrichment (existing summary fetch)
        + normalize predictor → matchup_prediction
```

## Page structure

### Preview

Inside `MlbProjectedLineups` two-column grid, right column stack:

1. `MlbGameOddsBoard` (existing)
2. `MlbGameInfo` (existing)
3. `MlbMatchupPrediction` (new)

Left column (lineups / team stats / injuries) unchanged.

### Live / Final / Box

No Matchup prediction card. Existing win-probability panels stay as-is.

## Card UI

- Charcoal `GameSection`; title **Matchup prediction** (18px semibold white).
- Horizontal split bar (team primary colors from `detail.away.color` / `detail.home.color`); widths = away/home win %.
- Row under bar: `{away.abbrev} {awayWinPct}%` … `{homeWinPct}% {home.abbrev}` (muted secondary text).
- Source line: `prediction.sourceLabel` (muted).
- If `matchupPrediction` is null → component returns `null` (no empty shell).

## Data & API

### Additive schema on `MlbGameDetail`

```
matchup_prediction: MlbMatchupPrediction | null

MlbMatchupPrediction:
  away_win_pct: int
  home_win_pct: int
  source_label: str
```

### Mapping rules

- Read ESPN summary `predictor` (same shape as WNBA).
- `away_win_pct` / `home_win_pct` = rounded floats from `awayTeam.gameProjection` / `homeTeam.gameProjection`.
- Invalid or missing predictor → `null`.
- Soft-fail inside ESPN enrichment; do not break Stats-backed detail.
- No new network calls beyond the existing summary fetch.

### Frontend view

Extend `MlbGameDetailView` + `mapMlbGameDetail` with camelCase `matchupPrediction`.

## File layout

```
backend/app/domains/mlb/schemas_game_detail.py   # MlbMatchupPrediction + field
backend/app/domains/mlb/game_detail.py           # normalize + attach in ESPN enrichment
backend/app/providers/espn/mlb_bridge.py         # optional normalize helper (if cleaner)
backend/tests/…                                  # normalize / enrichment tests
frontend/openapi.json + api.schema.d.ts
frontend/src/features/mlb/lib/types.ts
frontend/src/features/mlb/lib/mapMlbGameDetail.ts
frontend/src/features/mlb/game/MlbMatchupPrediction.tsx
frontend/src/features/mlb/game/MlbMatchupPrediction.test.tsx
frontend/src/features/mlb/game/MlbProjectedLineups.tsx
frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx
md/system-design.md
```

## Testing

### Backend

- ESPN summary fixture with `predictor` → mapped percents + source label.
- Missing / malformed predictor → `null`; detail still succeeds.
- Enrichment soft-fail path unchanged for injuries / win probability.

### Frontend

- Card renders bar, abbrevs, percents, source from sample detail.
- Null prediction → nothing rendered.
- Preview right column order: Odds → Game Info → Matchup prediction.
- Live/Final do not mount the card.

## Out of scope

- Live / Final Matchup prediction (they already have win-probability UI)
- Odds-implied win % as a fallback source
- Separate prediction endpoint
- Changing Game Info or odds board behavior
- Halftime stub

## Success criteria

- Scheduled MLB Preview shows Matchup prediction under Game Info when ESPN provides a projection.
- Card chrome matches MLB Preview right-rail siblings; bar behavior matches WNBA idea.
- Missing predictor does not break Preview; card simply omits.
- OpenAPI types stay in sync; brand remains **statvista**.
