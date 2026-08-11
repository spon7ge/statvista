# WNBA Team Tab Leaders: PPG RPG APG FG% 3FG%

## Goal

On Away/Home team tabs, **Team Leaders** show five cards in one row: **PPG, RPG, APG, FG%, 3FG%**.

## Non-goals

- Min-attempt filters for shooting %
- Changing Preview matchup `game_leaders` (PPG/RPG/APG only)
- MLB team-preview leaders
- Layout wrap / scroll (user chose `grid-cols-5`)

## Backend

- Expand `TeamLeaderKey` to `"ppg" | "rpg" | "apg" | "fg_pct" | "fg3_pct"`
- Labels: `PPG`, `RPG`, `APG`, `FG%`, `3FG%`
- In `PlayerSeasonStats`, add `fg_pct_value` / `fg3_pct_value` and optional `fg_pct_rank` / `fg3_pct_rank` from ESPN byathlete `fieldGoalPct` / three-point pct `value`/`rank`
- `build_team_leaders` iterates the five keys in that order; pick max numeric value among roster-joined players; rank may be null for shooting if ESPN omits it
- OpenAPI regen after schema change

## Frontend

- Widen `TeamLeaderCard.key` union
- `TeamLeadersSection`: `grid-cols-5` (was `grid-cols-3`)
- Existing card chrome unchanged

## Tests

- Backend: leaders keys `["ppg","rpg","apg","fg_pct","fg3_pct"]` on fixture
- Frontend: five card testids; grid class assert

## Files

- `backend/app/domains/wnba/schemas_team_preview.py`
- `backend/app/providers/espn/wnba_team_player_stats.py`
- `backend/tests/test_wnba_team_preview.py`
- OpenAPI trio + `api.schema.d.ts`
- `frontend/src/features/basketball/game/WnbaTeamPreview.tsx` (+ test)
