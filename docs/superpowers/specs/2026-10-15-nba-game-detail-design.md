# NBA game detail (preview / live / final)

Date: 2026-10-15  
Status: Approved for planning

## Goal

Ship NBA game pages with the same layout as WNBA: scheduled Preview / Away / Home, live and final Summary | Box. Entry from the NBA matchups slate. Full section parity with WNBA game detail; parallel NBA modules (no shared-center refactor in this pass).

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Full WNBA game-detail parity (layout + sections + supporting APIs) |
| URL | `/nba/games/:espnEventId` (WNBA stays `/games/:espnEventId`) |
| Components | Parallel `NbaPregameCenter` / `NbaLiveCenter` / `NbaFinalCenter` (+ `NbaInGameCenter`) |
| Delivery | Mirror WNBA end-to-end in `app/domains/nba/` + frontend twins |
| Card navigation | `gameDetailHref` returns `/nba/games/{espnEventId}` for `league === "nba"` |
| Back link | `/nba/matchups` |
| Odds | `GET /api/nba/odds/today` with WNBA-shaped `games` + `book_boards` (may be empty until NBA snapshots exist) |
| Starters | RotoWire NBA lineups when available; ESPN roster fallback like WNBA |
| Out of scope | NBA prop picks / DFS research board; renaming WNBA to `/wnba/games/...`; extracting shared basketball centers |

This supersedes the slate design note that NBA cards are non-clickable (`docs/superpowers/specs/2026-10-15-nba-games-slate-design.md`).

## Architecture

```
/nba/matchups card click
        │
        ▼
/nba/games/:espnEventId   (NbaGameDetailPage under HomeChromeLayout)
        │
        ├── scheduled  → NbaPregameCenter
        ├── live|ht    → NbaLiveCenter  → NbaInGameCenter
        └── final      → NbaFinalCenter → NbaInGameCenter
                │
                ├── GET /api/nba/games/{id}
                ├── GET /api/nba/odds/today          (Preview odds board)
                └── GET /api/nba/games/{id}/team-preview?side=
```

### Routing

| Path | Element |
| --- | --- |
| `/nba/games/:espnEventId` | `NbaGameDetailPage` |
| `/games/:espnEventId` | Unchanged WNBA `GameDetailPage` |

Chrome: `activeLeagueFromPath` already treats `/nba/...` as NBA.

### Page ↔ status

| Status | Center |
| --- | --- |
| `scheduled` | `NbaPregameCenter` |
| `live` / `halftime` | `NbaLiveCenter` |
| `final` | `NbaFinalCenter` |

## UI (WNBA layout twin)

**Pregame header:** record + last 10; centered Preview / Away / Home tabs.

**Preview (two columns)**

- Left: Projected Starters → Game Info → Matchup Prediction → Game Leaders (PPG / RPG / APG)
- Right: multi-book Odds board → Season Team Stats (+ `#rank`) → Injuries

**Away / Home:** team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-).

**Live / final:** broadcast header + Summary | Box.

- Summary: shot chart + play feed (Scoring | All); right rail linescore, team stats, win probability, Game Info
- Box: stacked away/home box score

**Shared leaves:** League-agnostic widgets (`BoxScore`, `ShotChart`, `InjuryReport`, `MatchupPrediction`, etc.) keep consuming `GameDetail`. New `Nba*` shells use `nba-*` test ids.

## Backend

Extend `backend/app/domains/nba/` (scoreboard already exists).

| Module | Role |
| --- | --- |
| `schemas_game_detail.py` | `NbaGameDetail` — same fields as `WnbaGameDetail`, `league: "nba"` |
| `game_detail.py` | ESPN NBA summary normalize + in-process cache (TTL, stale-while-error, 404, 502) |
| `schemas_team_preview.py` + `team_preview.py` | Away/Home leaders + roster averages |
| Season team stats / standings helpers | Preview Team Stats + ranks (WNBA twins, NBA upstream) |
| Odds route | `GET /api/nba/odds/today` — same shape as WNBA (`games[]` + `book_boards`) |

**Upstream**

- Summary: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=`
- Enrichment: ESPN NBA standings / roster / team player stats (outbound cache pattern where WNBA already uses it)
- Providers: NBA twins of WNBA roster/stats helpers; RotoWire NBA lineups; ESPN NBA logo/color patterns

**Odds reality:** There are no `odds.nba_*` team snapshot tables yet. The endpoint still ships with the WNBA response shape; `book_boards` may be empty (Sharp `games[]` fallback if available). UI soft-fails like WNBA when boards are empty. Scrapers/migrations for NBA books are out of scope unless required for a non-empty board in the same plan.

**Errors**

| Case | Behavior |
| --- | --- |
| Invalid event id / unknown game | `404` |
| Upstream failure, never cached | `502` + `Cache-Control: no-store` |
| Upstream failure after success | Serve last good payload |
| Optional enrichment fails | Soft-empty that section |

Wire routes into the API router; export OpenAPI / golden so frontend types regenerate.

## Frontend

| Piece | Role |
| --- | --- |
| `NbaGameDetailPage` | Shell: skeleton / unable-to-load / Back / status → center |
| `useNbaGameDetail` | `GET /api/nba/games/{id}`; poll ~18s when live/halftime |
| `useNbaOdds` | `GET /api/nba/odds/today` |
| `useNbaTeamPreview` | `GET /api/nba/games/{id}/team-preview?side=` |
| `gameDetailHref` | NBA → `/nba/games/{espnEventId}` |
| `MatchupGameCard` | Link + chevron when href present (NBA cards become navigable) |
| `AppRouter` | Route `/nba/games/:espnEventId` |
| `api.ts` + OpenAPI types | `fetchNbaGameDetail`, `fetchNbaOdds`, `fetchNbaTeamPreview` |

Reuse `mapGameDetail` when response field names match WNBA.

## Error handling (UI)

| Case | Behavior |
| --- | --- |
| Loading first paint | Skeleton (WNBA twin) |
| Never loaded / 404 | “Unable to load game” + Back to `/nba/matchups` |
| Refetch error after success | Keep last good detail |
| Missing odds / starters / preview / prediction | Hide or empty that block; page still renders |

## Testing

**Backend**

- Normalize ESPN NBA summary fixture (status, teams, plays, shots, box, win prob)
- Route tests: game detail, team-preview, odds (200 shape; 404; 502)

**Frontend**

- `gameDetailHref` / `MatchupGameCard`: NBA with `espnEventId` → `/nba/games/...`
- Router: `/nba/games/:id` renders NBA shell
- `NbaGameDetailPage`: scheduled → pregame; live/halftime → live; final → final
- Center smoke tests with `nba-*` test ids

**Docs**

- Update `md/system-design.md`: `/nba/matchups` cards → `/nba/games/:id`; list new NBA APIs
- Note slate design “non-clickable cards” is superseded

## Success criteria

1. NBA matchup cards open preview / live / final pages with WNBA-equivalent layout.
2. Supporting APIs: game detail, team-preview, odds/today.
3. WNBA `/games/:id` behavior unchanged.
4. OpenAPI export + frontend `check:api` green.
5. `md/system-design.md` page ↔ API map updated.

## Out of scope (explicit)

- NBA `/nba/prop_picks` research board and DFS assembly
- Moving WNBA to `/wnba/games/:id`
- Shared basketball center extraction / deep-module refactor
- New NBA odds scrapers and DB migrations (unless needed later for populated `book_boards`)
