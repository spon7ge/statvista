# WNBA team-preview leaders + efficiency roster cols

Date: 2026-08-21  
Status: Approved  
Related: Away/Home scheduled tabs (`WnbaTeamPreview`); ESPN byathlete season stats

## Goal

On **scheduled** WNBA Away/Home tabs only:

1. Top leader cards show **PPG, RPG, APG, BPG, SPG** (replace FG% / 3FG%).
2. Roster table adds efficiency columns from ESPN: **SH-EFF, SC-EFF, PPEP, RTG, +/-**.

Live/final game centers stay Summary | Boxscore (no Away/Home change).

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Scheduled Away/Home team-preview only |
| Approach | Extend existing `GET /api/wnba/games/{id}/team-preview` (one response) |
| Leader set | `ppg`, `rpg`, `apg`, `bpg`, `spg` |
| Dropped leaders | `fg_pct`, `fg3_pct` |
| BPG / SPG source | ESPN `avgBlocks` / `avgSteals` (display + value + rank when present) |
| MPG gate | None for BPG/SPG (shooting MPG gate removed with FG%/3FG% leaders) |
| Advanced cols | `sh_eff`, `sc_eff`, `ppep`, `rtg`, `plus_minus` |
| ESPN map | `shootingEfficiency`, `scoringEfficiency`, `pointsPerEstimatedPossessions`, `NBARating`, `plusMinus` |
| Not in scope | Classic TS%/eFG%/USG% (not in ESPN byathlete); live Away/Home tabs; second advanced endpoint |

## Architecture

```
WnbaPregameCenter Away|Home
        │
        └─ useWnbaTeamPreview(side)
              └─ GET /api/wnba/games/{espnEventId}/team-preview?side=
                    ├─ leaders[5]: PPG RPG APG BPG SPG
                    └─ roster[]: existing traditional + SH-EFF SC-EFF PPEP RTG +/-
```

Provider: `backend/app/providers/espn/wnba_team_player_stats.py`  
Schemas: `backend/app/domains/wnba/schemas_team_preview.py`  
UI: `frontend/src/features/basketball/game/WnbaTeamPreview.tsx`

## API changes

### `TeamLeaderKey`

```text
ppg | rpg | apg | bpg | spg
```

Labels: PPG, RPG, APG, BPG, SPG.

### `WnbaTeamRosterRow` (new optional string fields)

| Field | UI label | ESPN `name` |
| --- | --- | --- |
| `sh_eff` | SH-EFF | `shootingEfficiency` |
| `sc_eff` | SC-EFF | `scoringEfficiency` |
| `ppep` | PPEP | `pointsPerEstimatedPossessions` |
| `rtg` | RTG | `NBARating` |
| `plus_minus` | +/- | `plusMinus` |

Existing traditional fields unchanged (`gp` … `ft_pct`). Null when ESPN omits the stat.

After schema change: export OpenAPI → regenerate `frontend` types → `npm run check:api`.

## Backend behavior

1. Extend `PlayerSeasonStats` with stl/blk **values + ranks** (for BPG/SPG leaders) and the five efficiency display strings (+ numeric values only if needed for sorting — not required for leaders).
2. `_stats_from_flat`: map the ESPN names above via `_display` / `_as_float` / `_as_int` (rank on blocks/steals).
3. `build_team_leaders`: iterate new `_LEADER_KEYS`; remove `_SHOOTING_LEADER_KEYS` / MPG gate (or leave unused).
4. `merge_roster_rows`: pass through new roster fields.
5. Tests: fixture byathlete items include `avgBlocks`/`avgSteals` ranks + efficiency stats; assert leader keys and roster fields.

## Frontend behavior

1. Leader card union type: `ppg | rpg | apg | bpg | spg`.
2. Roster cols: append **SH-EFF, SC-EFF, PPEP, RTG, +/-** after FT% (keep existing traditional columns).
3. Map new API fields in `mapWnbaTeamPreview`.
4. Tests: assert five leader labels; assert new column headers / cell values when present.

## Error handling

- Missing efficiency or rank → `null` / omit rank on card (same as today).
- Empty roster / leaders → empty arrays (unchanged).
- ESPN fetch failures → existing team-preview error path.

## Non-goals

- Live/final Away/Home tabs
- Inventing TS%/eFG%/USG% formulas
- Changing Preview-tab `WnbaGameLeaders` (still PPG/RPG/APG matchup-wide)
- Changing MLB team preview

## Success criteria

- Away/Home top cards are PPG, RPG, APG, BPG, SPG with correct players.
- Roster shows SH-EFF, SC-EFF, PPEP, RTG, +/- when ESPN provides them.
- OpenAPI / frontend types in sync; existing team-preview tests updated and passing.
