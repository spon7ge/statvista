# MLB Preview Away/Home Team Leaders & Roster Stats

Date: 2026-08-10  
Status: Approved  
Related: [Game Leaders](./2026-08-08-mlb-preview-game-leaders-design.md) (card chrome / selection pattern)

## Goal

On MLB scheduled game preview (`/mlb/games/:gamePk`), replace the Away and Home team-name tab stubs with a **team preview**: that team’s batting and pitching leaders (Game Leaders–style cards) plus full active-roster season batting and pitching tables.

Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | Away tab → away team only; Home tab → home team only |
| Layout | **B** — two columns on desktop: batting left, pitching right; stack batting then pitching on narrow |
| Leaders | Batting: HR · AVG · OPS; Pitching: ERA · SO · WHIP — one leader per category |
| Card chrome | Same as Game Leaders (label, value, muted `#N`, last name, ESPN headshot); **no team logo** (single-team tab) |
| Titles | **Team Batting Leaders** / **Team Pitching Leaders**; tables **Batting** / **Pitching** |
| Roster tables | Season core columns (see below); horizontal scroll for overflow |
| Default sorts | Batting by OPS desc; pitching by IP desc (fixed in v1 — no clickable column headers) |
| Player pool | Active roster only |
| Data load | **Lazy** dedicated endpoint when Away/Home tab is active (do not bloat `GET /api/mlb/games/{gamePk}`) |
| Soft-fail | Never break the game page; omit empty leader sections; empty tables show short empty copy |
| Scope of tab | Leaders + roster tables only (no other team-preview sections in this pass) |

## Architecture

```
MlbPregameCenter
  tabs: preview | away | home | props
  away / home → MlbTeamPreview(side)
                 └── useMlbTeamPreview(gamePk, side)  // enabled only when that tab active
                       GET /api/mlb/games/{gamePk}/team-preview?side=away|home

Backend team-preview
  ├── resolve game → team id / abbrev / season
  ├── active roster ids (existing helper)
  ├── batting leaders (hr/avg/ops) from season boards ∩ roster
  ├── pitching leaders (era/so/whip) from season boards ∩ roster
  ├── batting roster season rows (Stats teamId + hitting)
  ├── pitching roster season rows (Stats teamId + pitching)
  └── ESPN headshot index for leader cards
```

## UI

Desktop (layout B):

```
┌─ Washington Nationals (Away tab) ─────────────────────────┐
│  ┌── Batting column ──┐  ┌── Pitching column ──┐         │
│  │ Team Batting       │  │ Team Pitching       │         │
│  │ Leaders            │  │ Leaders             │         │
│  │ [HR][AVG][OPS]     │  │ [ERA][SO][WHIP]     │         │
│  │                    │  │                     │         │
│  │ Batting (table)    │  │ Pitching (table)    │         │
│  │ PLAYER G AVG …     │  │ PLAYER G GS …       │         │
│  └────────────────────┘  └─────────────────────┘         │
└───────────────────────────────────────────────────────────┘
```

Narrow: single column — batting leaders → batting table → pitching leaders → pitching table.

Loading: compact pending state inside the tab panel.  
Query error: short message with retry affordance if the app already has that pattern; otherwise plain error text.  
Empty leaders for one discipline → omit that `GameSection`.  
Empty roster list → section with “No season stats available”.

## API

### Route

`GET /api/mlb/games/{game_pk}/team-preview?side=away|home`

- Invalid / missing `side` → **400**
- Unknown `game_pk` → **404**
- Scheduled (and any status that can resolve teams) OK; prefer same game resolution as game detail. Soft-empty payload on Stats failures rather than 5xx when the game exists.

### Response schema

```
MlbTeamPreview:
  side: "away" | "home"
  team: { id: str, abbrev: str, name: str, logo_url: str | null }
  batting_leaders: list[MlbTeamLeaderCard]   # 0–3; keys hr|avg|ops
  pitching_leaders: list[MlbTeamLeaderCard]  # 0–3; keys era|so|whip
  batting_roster: list[MlbTeamBatterSeasonRow]
  pitching_roster: list[MlbTeamPitcherSeasonRow]

MlbTeamLeaderCard:
  key: "hr" | "avg" | "ops" | "era" | "so" | "whip"
  label: str
  rank: int | null
  value: str
  player_id: str
  last_name: str
  headshot_url: str | null
  # no side / team_abbrev required on card (team is on parent)

MlbTeamBatterSeasonRow:
  player_id: str
  name: str                 # prefer Stats boxscoreName; else fullName
  g: int | null
  ab, r, h, hr, rbi, bb, so, sb: int | null
  avg, obp, slg, ops: str | null   # display-ready (e.g. ".312")

MlbTeamPitcherSeasonRow:
  player_id: str
  name: str                 # prefer Stats boxscoreName; else fullName
  g, gs, w, l, sv, h, er, bb, so: int | null
  ip, era, whip: str | null        # display-ready (e.g. "130.1", "2.41")
```

OpenAPI: add schemas + path; regenerate client types if the project does so for MLB routes.

### Selection rules (leaders)

1. Load active roster person ids for the requested side’s team.
2. For each batting key (`hr`, `avg`, `ops`) and pitching key (`era`, `so`, `whip`): fetch season board with **`limit=100`** (same path / qualification as Leaders page + Game Leaders).
3. First board row whose `player_id` is on that roster → that category’s leader; attach ESPN headshot via existing name normalize.
4. Omit category if no roster hit in the window.
5. Empty both leader lists is fine if tables still return data.

### Roster tables

1. Fetch season hitting / pitching player splits for `teamId` + season (Stats `stats=season` + `group` + `teamId`; prefer one call per group).
2. Prefer rows for active-roster players; if Stats already returns team season player rows, filter to active roster when ids are available, else show returned team season rows.
3. Map to season-core columns:
   - **Batting:** G · AVG · OBP · SLG · OPS · AB · R · H · HR · RBI · BB · SO · SB
   - **Pitching:** G · GS · W · L · SV · IP · H · ER · BB · SO · ERA · WHIP
4. Sort: batting by OPS desc (nulls last); pitching by IP desc (nulls last). FE may re-sort identically after map for stability.

### Soft-fail & caching

- Log warnings on roster / board / ESPN / stats failures; return partial payload.
- Reuse active-roster TTL; cache season boards and team player-stat payloads ~10–15 min keyed by team/season/group.
- Never raise out of team-preview into an unhandled 500 when the game resolves (prefer empty lists).

## Frontend

- `MlbTeamPreview` (+ small leaders/table subcomponents or inline) under `features/mlb/game/`.
- `useMlbTeamPreview({ gamePk, side, enabled })` — `enabled` when `activeTab === side`.
- Wire in `MlbPregameCenter`: replace stub copy for away/home.
- Reuse Game Leaders visual tokens (`GameSection`, card classes) where practical; extract shared card piece only if duplication is painful.
- Map snake_case API → camelCase views.
- Tests + fixtures; update `md/system-design.md` page ↔ API table.

## Testing

**Backend**

- Leaders: picks best roster player per category; omits when outside board window.
- Roster: column mapping for batting + pitching; sort order.
- Validation: bad `side` → 400; unknown game → 404.
- Soft-fail: board failure → empty leaders, tables still attempted (and vice versa).

**Frontend**

- Away/Home render `MlbTeamPreview` instead of stub.
- Two-column layout; leader titles; tables present with expected headers.
- Hide empty leader section; empty table copy; loading when pending.
- Hook disabled on Preview/Props tabs.

## Out of scope

- Live / Final Away-Home team tabs
- Clickable sortable table headers
- Player profile deep links
- Non-active / IL-only expanded rosters
- Changing Preview **Game Leaders** (still batting-only, both teams)
- Additional team-preview modules (injuries, depth chart, etc.)

## Success criteria

- Clicking Away or Home on a scheduled MLB game shows that team’s batting + pitching leader cards and full season roster tables in a two-column (stacked on narrow) layout.
- Data loads lazily via `team-preview`; Preview tab performance unchanged.
- Soft-fail; stubs removed for those tabs.
