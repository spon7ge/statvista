# MLB league leaders page

Date: 2026-08-07  
Status: Implemented

## Goal

Ship `/mlb/leaders` matching the WNBA leaders page pattern: Explore subnav with Leaders active, season label, and a responsive grid of top-10 boards. Twelve boards cover hitting and pitching. Typography uses **18px** for primary table/content text and **14px** for subtle chrome. Numbers come from MLB StatsAPI via a backend proxy. Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB only; WNBA leaders unchanged (including its current type sizes) |
| Data source | `statsapi.mlb.com` `/api/v1/stats` season splits sorted by category (includes `gamesPlayed`; `/stats/leaders` has no GP) |
| Categories | 12 boards below, top 10 each, StatsAPI-qualified season leaders |
| Season label | `{season} season` (not “per game”) |
| Page chrome | No league hero; subnav → title/season → grid → attribution |
| Team colors | Hardcoded frontend MLB abbrev→color map (new `mlbTeamColors.ts`) |
| Team abbrev | Backend maps StatsAPI `team.id` → abbreviation (teams list or static map) |
| GP column | Keep column; populate from season split `gamesPlayed` (nullable only if upstream omits it → UI `—`) |
| Player links | Plain text names (no `/mlb/player/:id` route yet) |
| Subnav | Enable Leaders for `league === "mlb"` → `/mlb/leaders` |
| Attribution | `Data: statsapi.mlb.com` |
| Typography | Primary content **18px**; subtle text **14px** (see UI) |
| Out of scope | AL/NL split, career leaders, filters, scrapers/Supabase, WNBA font changes |

## Categories (fixed order)

| Order | Key | Label | Stat | StatsAPI `leaderCategories` | `statGroup` |
| --- | --- | --- | --- | --- | --- |
| 1 | `avg` | Batting Average | AVG | `battingAverage` | `hitting` |
| 2 | `hr` | Home Runs | HR | `homeRuns` | `hitting` |
| 3 | `rbi` | RBI | RBI | `runsBattedIn` | `hitting` |
| 4 | `sb` | Stolen Bases | SB | `stolenBases` | `hitting` |
| 5 | `ops` | OPS | OPS | `onBasePlusSlugging` | `hitting` |
| 6 | `hits` | Hits | H | `hits` | `hitting` |
| 7 | `era` | ERA | ERA | `earnedRunAverage` | `pitching` |
| 8 | `whip` | WHIP | WHIP | `walksAndHitsPerInningPitched` | `pitching` |
| 9 | `so` | Strikeouts | SO | `strikeouts` | `pitching` |
| 10 | `w` | Wins | W | `wins` | `pitching` |
| 11 | `sv` | Saves | SV | `saves` | `pitching` |
| 12 | `ip` | Innings Pitched | IP | `inningsPitched` | `pitching` |

Always pass `statGroup` with each request (omitting it returns wrong groups for some categories).

## Architecture

```
HomeNav MLB → /mlb/matchups (existing)
LeagueSubnav Leaders → /mlb/leaders
        │
        ▼
  MlbLeadersPage (HomeChromeLayout)
        │
        ├── LeagueSubnav (mlb; Leaders active)
        ├── "{season} season"
        ├── MlbLeadersGrid (12× MlbLeaderCategoryCard)
        └── "Data: statsapi.mlb.com"
        │
        ▼
  useMlbLeaders() → GET /api/mlb/leaders
        │
        ▼
  statsapi.mlb.com /api/v1/stats (season, sortStat per category, limit=10)
        → normalize (incl. gamesPlayed) → twelve top-10 categories → cache
```

### Routing

| Path | Element |
| --- | --- |
| `/mlb/leaders` | `MlbLeadersPage` under `HomeChromeLayout` |

- `LeagueSubnav`: when `league === "mlb"`, Leaders → `/mlb/leaders` (same as WNBA enablement pattern).
- Active pill: pathname ends with `/leaders`.
- HomeNav MLB active pill continues to cover any pathname starting with `/mlb`.

## Page structure

1. **LeagueSubnav** — `league="mlb"`; Matchups, Prop Picks, Leaders enabled.
2. **Header** — title “Leaders”; muted season line `{season} season`.
3. **Grid** — `1` / `md:2` / `lg:3` columns; 12 category cards in table order above.
4. **Attribution** — `Data: statsapi.mlb.com`.

### Typography (MLB only)

| Element | Size |
| --- | --- |
| Category title | 18px |
| Table body (rank, player, team, value) | 18px |
| Season subtitle | 14px |
| Table header row | 14px |
| GP column (muted) | 14px |
| Attribution | 14px |
| Loading / error copy | 14px |
| Page title “Leaders” | Keep WNBA-like prominence (`text-2xl` / `sm:text-3xl`) for page hierarchy |

### Category card

- Same charcoal card treatment as WNBA (`rounded-xl border border-white/10 bg-white/[0.03]`).
- Columns: `#` | Player | Team | GP | `{STAT}`.
- Ten rows; team abbrev colored via `mlbTeamColors`; unknown → muted white.
- Player name is **not** a link.
- Empty leaders → “No data”.
- Loading: 12 skeleton cards.

## API contract

`GET /api/mlb/leaders`

Response (mirrors WNBA shape with MLB keys / pace):

```json
{
  "season": 2026,
  "pace": "season",
  "categories": [
    {
      "key": "avg",
      "label": "Batting Average",
      "stat": "AVG",
      "leaders": [
        {
          "rank": 1,
          "player_id": "670541",
          "name": "Yordan Alvarez",
          "team_abbrev": "HOU",
          "gp": 115,
          "value": ".328"
        }
      ]
    }
  ]
}
```

- `MlbLeadersResponse`: `season: int`, `pace: Literal["season"]`, `categories: list[MlbLeaderCategory]`
- `MlbLeaderRow`: `rank`, `player_id` (stringified MLBAM id), `name`, `team_abbrev`, `gp: int | None`, `value: str` (pass through StatsAPI string; preserve AVG leading decimal)
- Cache-Control: `no-store` on handler; in-process cache TTL **10 minutes** with stale-on-refresh-failure (same pattern as WNBA).
- Hard upstream failure → 502.

### Backend modules

- `backend/app/domains/mlb/schemas_leaders.py`
- `backend/app/domains/mlb/leaders.py` (fetch + normalize + cache)
- Route on MLB router: `GET /leaders`
- Register path in `openapi_export.REQUIRED_MLB_PATHS`
- Update `md/system-design.md` page ↔ API table

### Upstream fetch

- Base: `https://statsapi.mlb.com/api/v1/stats`
- Params per category: `stats=season`, `group` (hitting|pitching), `sortStat`, `order` (`asc` for ERA/WHIP, else `desc`), `season`, `sportIds=1`, `limit=10`; `playerPool=qualified` for AVG/OPS/ERA/WHIP
- Prefer concurrent fetches for the 12 categories (bounded gather).
- Team abbrev: one cached `GET /api/v1/teams?sportId=1&season={season}` id→abbreviation map via `canonical_mlb_abbrev`; fallback `"???"` if missing.
- Row `gp` from split `stat.gamesPlayed`; value from `stat[sortStat]` (preserve string forms like `.329`).
- Do not invent ranking — use StatsAPI `rank` as returned.

## Frontend modules

| File | Role |
| --- | --- |
| `pages/MlbLeadersPage.tsx` (or league page under mlb) | Wire subnav + grid + hook |
| `features/mlb/hooks/useMlbLeaders.ts` | Fetch/cache client state |
| `features/mlb/league/MlbLeadersGrid.tsx` | Header, skeletons (12), grid, attribution |
| `features/mlb/league/MlbLeaderCategoryCard.tsx` | Card + table with MLB type sizes |
| `features/mlb/league/mlbTeamColors.ts` | Abbrev → hex |
| `shared/lib/api.ts` | `fetchMlbLeaders` |
| `LeagueSubnav.tsx` | Enable MLB Leaders path |
| `AppRouter.tsx` | Register `/mlb/leaders` |

OpenAPI: export golden + `frontend/openapi.json` + regenerate `api.schema.d.ts`.

Do **not** change WNBA `LeaderCategoryCard` / `LeadersGrid` font sizes.

## Testing

**Backend**

- Normalize fixture → 12 categories in order; top-10 length; AVG value preserves string form; WHIP uses `walksAndHitsPerInningPitched`.
- Route returns 200 schema; 502 when upstream hard-fails and no stale cache.
- `statGroup` required in constructed URLs (unit assert).

**Frontend**

- Subnav Leaders navigates for MLB; active on `/mlb/leaders`.
- Page renders season label without “per game”; attribution `statsapi.mlb.com`.
- Cards show 18px body / 14px subtle (assert via class names `text-[18px]` / `text-[14px]`).
- Player names are not links.
- Loading shows 12 skeletons.

## Success criteria

- `/mlb/leaders` live with 12 boards from StatsAPI.
- Subnav Leaders enabled for MLB.
- Typography: 18px primary / 14px subtle as specified.
- OpenAPI + system-design updated; WNBA leaders unchanged.
