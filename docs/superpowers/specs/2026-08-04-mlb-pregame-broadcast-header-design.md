# MLB pregame broadcast header (scheduled game detail)

Date: 2026-08-04  
Status: Approved for planning  
Reference: user screenshot (WSH @ PHI scheduled — split header with name, season record, last-10 form, Preview / team tabs)

## Goal

On `/mlb/games/:gamePk` when status is **scheduled**, replace the compact header and “Not live yet” placeholder with a final-style broadcast shell: split team-color slabs showing **team name, season record, and last-10 record**, plus stub tabs **Preview | Away | Home**. Extend game-detail with additive `last_10` from MLB Stats API standings.

Live and final layouts are out of scope. Real Preview / team tab content is out of scope (stubs only).

## Decisions

| Topic | Choice |
| --- | --- |
| Recent form window | Season record + **Last 10** only (not Last 5) |
| Scope | Header + stub tabs (Preview / Away / Home); no real tab bodies yet |
| Approach | Extend game-detail with `last_10` + dedicated pregame header/center (do not overload final header) |
| Data | Soft-attach standings `lastTen` onto existing `GET /api/mlb/games/{gamePk}` |
| Share control | UI affordance only; no share backend |
| Halftime | Keep current compact / “Not live yet” path (pregame shell is **scheduled only**) |

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Today · start time (statusLabel)              [share]    │
├────────────────────────────┬─────────────────────────────┤
│ Away slab (team color)     │ Home slab (team color)      │
│ large logo (faded / edge)  │ large logo (faded / edge)   │
│ Name                       │ Name                        │
│ 55-59                      │ 60-53                       │
│ 0-5 in Last 10             │ 3-2 in Last 10              │
├────────────────────────────┴─────────────────────────────┤
│ [ Preview | Away name | Home name ]  (stubs)             │
├──────────────────────────────────────────────────────────┤
│ Stub panel (“Preview coming soon” / team stub)           │
└──────────────────────────────────────────────────────────┘
```

### Desktop / mobile

- Header strip + split slabs full width (same grid pattern as final).
- Slabs remain side-by-side; text stacks under the name (record, then last 10).
- Away text right-aligned toward the seam; home text left-aligned toward the seam.

## Components

| Piece | Responsibility |
| --- | --- |
| `MlbPregameBroadcastHeader` | Date/time · share; split colored slabs with logo, name, season record, last-10 line; Preview \| Away \| Home tabs |
| `MlbPregameCenter` | Composition wrapper: header + stub tab panels |
| `MlbGameDetailPage` | Scheduled branch → `MlbPregameCenter` (replace `CompactMlbHeader` + “Not live yet”) |
| `MlbFinalBroadcastHeader` / live shell | Unchanged |

Tab labels use each team’s display **name** (e.g. Nationals / Phillies), not abbrev.

## Data / API (additive on `MlbGameDetail`)

No new endpoints. Extend schema + normalize/attach in `backend/app/services/mlb_game_detail.py`; regenerate OpenAPI / frontend types.

| Field | Source (Stats API) | UI use |
| --- | --- | --- |
| `away` / `home.record` | Existing team `leagueRecord` on live feed | `55-59` |
| `away` / `home.last_10` | Standings `teamRecords[].lastTen` for matching team id | `0-5 in Last 10` |
| `game_date_label` | Existing | `Today` / `Yesterday` / short date |
| `status_label` | Existing scheduled start label | Paired with date in top row |

### Standings attach

1. After live-feed normalize, soft-fetch `https://statsapi.mlb.com/api/v1/standings?sportId=1` (league ids as needed for full MLB coverage).
2. Build team-id → `lastTen` map from `records[].teamRecords[]`.
3. Set `away.last_10` / `home.last_10` when present (string as returned, e.g. `"3-7"`).
4. Cache standings ~10 minutes process-wide; standings failure must not fail game detail (`last_10` stays null).
5. Frontend formats display as `{last10} in Last 10` when non-null.

Omit record / last-10 lines independently when missing. Do not invent zeros.

### Frontend mapping

- Extend `MlbGameDetailTeam` / `mapMlbGameDetail` with view-model `last10: string | null` from API `last_10`.
- OpenAPI codegen picks up `last_10` → client types.

## Edge cases

- Missing `record` → omit season-record line only.
- Missing `last_10` → omit last-10 line only.
- Standings unavailable / timeout → game detail still 200; both `last_10` null.
- Share button is non-functional affordance (same as final).
- `halftime` does not use this shell.

## Testing

- Backend: parse `lastTen` from a standings fixture onto both teams; assert null when standings soft-fails.
- Frontend: pregame header renders name, record, last-10, three tabs; scheduled page mounts `MlbPregameCenter`.
- Mapper: `last_10` → `last10` on the view model.

## Out of scope

- Real Preview content, odds, probable pitchers, or team-tab rosters
- Changing live or final headers
- MLB standings page
- Last-5 form
- Computing last-10 from play history instead of standings

## Success criteria

- Opening a scheduled MLB game shows the split broadcast header with name, season record, and last-10 when data is present.
- Preview / Away / Home tabs switch stub panels without errors.
- Live and final game pages are visually and behaviorally unchanged.
- Game detail still loads if standings enrichment fails.
