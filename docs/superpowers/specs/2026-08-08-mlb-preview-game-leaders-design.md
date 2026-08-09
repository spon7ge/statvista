# MLB Preview Game Leaders (batters)

Date: 2026-08-08  
Status: Draft  
Supersedes (UI + leaders payload shape): Matchup Leaders portion of [2026-08-08-mlb-preview-team-ranks-matchup-leaders-design.md](./2026-08-08-mlb-preview-team-ranks-matchup-leaders-design.md)  
Keeps: Team Stats league ranks (unchanged)

## Goal

Replace Preview **Matchup Leaders** with **Game Leaders**: three ESPN-style batter cards for the highest **HR**, **AVG**, and **OPS** among either team’s active roster — each showing stat label, value + muted league `#N`, last name + team logo, and ESPN headshot.

Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Title | **Game Leaders** |
| Placement | Right column under Matchup prediction (same slot as today’s Matchup Leaders) |
| Categories | Hitting only: HR · AVG · OPS (no pitching) |
| Depth | One leader per category (best in this game), not a top-3 list / tabs |
| Player pool | Active roster batters for away + home |
| Rank display | Season value + muted league `#N` |
| Headshot | ESPN CDN via existing MLB ESPN roster index (name match); placeholder on miss |
| Name display | Last name only |
| Chrome | Charcoal `GameSection`; three equal cards in a row (stack on narrow) |
| API | Still extend `GET /api/mlb/games/{gamePk}` only |
| Payload | Rename/replace `matchup_leaders` → `game_leaders` (breaking for the just-shipped field; no external clients) |
| Missing | Soft-fail; hide box when all three leaders null/absent; never fail game detail |

## Architecture

```
MlbProjectedLineups right column:
  MlbGameOddsBoard
  MlbGameInfo
  MlbMatchupPrediction
  MlbGameLeaders          ← replaces MlbMatchupLeaders

GET /api/mlb/games/{gamePk} (scheduled)
  └── _attach_game_leaders (replaces matchup leaders attach)
        + active rosters (away + home)
        + season hitting boards for hr / avg / ops (deep enough to pick in-game best + rank)
        + ESPN roster index → headshot_url by normalized name
```

## UI

Inspired by ESPN Team Leaders cards (dark cards, vertical stack), adapted to Preview charcoal:

```
┌──────────── Game Leaders ────────────┐
│  ┌─────┐  ┌─────┐  ┌─────┐           │
│  │ HR  │  │ AVG │  │ OPS │           │
│  │ 33  │  │.312 │  │.945 │           │
│  │ #4  │  │ #12 │  │ #8  │           │  ← muted #N
│  │OLSON│  │NAME │  │NAME │ + logo    │
│  │[img]│  │[img]│  │[img]│           │  ← ESPN headshot
│  └─────┘  └─────┘  └─────┘           │
└──────────────────────────────────────┘
```

Per card (top → bottom):

1. Stat label (`HR` / `AVG` / `OPS`)
2. Stat value (display-ready string)
3. Muted league rank (`#N`) — omit rank line if rank null
4. Last name (uppercase or title-case consistent with nearby MLB UI) + team logo
5. ESPN headshot image; on error/null → initial / muted placeholder (same idea as prop-picks headshot fallback)

Grid: `grid-cols-3` on desktop; may stack or stay 3-across on mobile if space allows (prefer 3-across with smaller type rather than tabs).

`game_leaders` null or empty leaders → component returns `null`.

## Data & API

### Schema (replace matchup leaders)

```
game_leaders: MlbGameLeaders | null

MlbGameLeaders:
  leaders: list[MlbGameLeaderCard]   # 0–3; prefer always emit present categories only

MlbGameLeaderCard:
  key: "hr" | "avg" | "ops"
  label: str                 # "HR" | "AVG" | "OPS"
  rank: int | null           # league rank
  value: str                 # display-ready
  player_id: str             # MLB Stats person id
  last_name: str
  team_abbrev: str
  side: "away" | "home"
  headshot_url: str | None   # ESPN CDN
```

Remove `matchup_leaders` / `MlbMatchupLeader*` from the public game-detail contract (OpenAPI regen).

### Selection rules

1. Load active roster person ids for away + home (existing roster helper).
2. For each of `hr`, `avg`, `ops`: fetch a season hitting leaderboard with **`limit=100`** (same `/api/v1/stats` sorted path and AVG/OPS qualification as the Leaders page) so in-game leaders outside the public top 10 still resolve with a league `rank`.
3. Filter board rows to roster player ids; take the **first** remaining row (best by league order) as that category’s Game Leader.
4. If no roster player appears in the fetched window for a category → omit that card (do not invent ranks).
5. If all three omitted → `game_leaders: null`.
6. Derive `last_name` from `fullName` (last whitespace token; handle Jr./III lightly if already patterned elsewhere, else last token is fine).
7. Resolve `headshot_url` via `get_mlb_player_index()` / name normalize → ESPN headshot template; miss → `null`.

### Soft-fail

- Roster / board / ESPN index failures: log warning; degrade to fewer cards or `null`.
- Never raise out of game detail.

### Caching

- Reuse roster TTL.
- Cache deeper hitting boards per `(sort_stat, season)` ~10–15 min.
- ESPN roster index already cached.

## Frontend

- Replace `MlbMatchupLeaders` with `MlbGameLeaders` (or rename file/component).
- Map `game_leaders` → `gameLeaders`.
- Update fixtures/tests/placement asserts (`mlb-game-leaders`, card testids).
- Update `md/system-design.md` Preview row.

## Testing

- Backend: pick best roster batter per category; omit when outside window; headshot enrichment; soft-fail → null.
- Frontend: three cards layout; value + `#N`; last name + logo; headshot/fallback; hide when null; under Matchup prediction.

## Out of scope

- Pitching Game Leaders
- Top-3 lists / category tabs
- Team Stats rank behavior (unchanged)
- “See roster” link from ESPN mock
- Live/Final Game Leaders UI

## Success criteria

- Preview shows **Game Leaders** with up to three batter cards (HR / AVG / OPS).
- Each card: label, value + `#N` when known, last name + logo, ESPN headshot when resolved.
- Soft-fail; Team Stats ranks untouched.
