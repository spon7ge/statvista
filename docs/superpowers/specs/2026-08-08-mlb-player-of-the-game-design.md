# MLB Final Player of the Game

Date: 2026-08-08  
Status: Approved for planning  
Route: `/mlb/games/:gamePk` (Final only)  
Brand: **statvista**

## Goal

For **Final** MLB games, soft-merge the official fan-vote [MLB Player of the Game](https://www.mlb.com/apps/player-of-the-game/game) winner into game detail and show a stacked card **above the Play feed**. Hide the card until a winner exists.

## Decisions

| Topic | Choice |
| --- | --- |
| Source | Official MLB Play / Genius Sports fan-vote POTG (not boxscore-derived) |
| No winner yet | Hide card entirely (`null`) |
| Fetch | Hybrid: cache by `gamePk`, on-demand fetch on miss/stale, soft-fail |
| API shape | Soft-merge on existing `GET /api/mlb/games/{gamePk}` only |
| Placement | Final Summary left column, above `MlbFinalPlayFeed` |
| Layout | Stacked center (B): headshot → bold boxed label → name → showcase stats |
| Live / scheduled | Always `player_of_the_game: null`; no UI |
| Failure | Never fail game detail; return null |

## Architecture

```
MlbGameDetailPage (status === final)
└─ MlbFinalCenter
   └─ Summary tab (left column)
      ├─ MlbPlayerOfTheGame     ← new; null → omit
      └─ MlbFinalPlayFeed

GET /api/mlb/games/{gamePk} (final)
  └── _attach_player_of_the_game
        1. read cache[gamePk]
        2. else fetch MLB Play / Genius POTG winner for gamePk
        3. on success → write cache + attach schema
        4. on miss/error → null (optional short negative TTL so late winners can appear on refresh)
```

Upstream is the MLB.com Player of the Game Play app (static `json/games|players|squads` + authenticated/contest `pog/*` winner routes), **not** `statsapi` `liveData.decisions` and **not** ESPN summary.

## UI

Stacked center card (charcoal / Final Summary chrome):

```
┌────────────────────────────────┐
│           [headshot]           │
│   ┌──────────────────────┐     │
│   │ PLAYER OF THE GAME   │     │  ← bold + boxed
│   └──────────────────────┘     │
│         Aaron Judge            │
│            NYY                 │  ← muted
│     3-4 · 2 HR · 5 RBI         │  ← showcase from scrape
└────────────────────────────────┘
Play feed …
```

- Headshot: mlbstatic people headshot from MLB person id (`feedId`); on error → initial / muted placeholder (same pattern as Game Leaders / prop picks)
- Label: **PLAYER OF THE GAME**, bold, boxed border
- Name: full name (or last name if scrape only provides that — prefer full when available)
- Stats: showcase line(s) exactly as exposed by the winner payload (string or structured label/value list normalized to a display line)
- Component returns `null` when `playerOfTheGame` is null

## Data & API

### Schema (additive)

```
player_of_the_game: MlbPlayerOfTheGame | null

MlbPlayerOfTheGame:
  player_id: str          # MLB person id / feedId
  full_name: str
  last_name: str
  team_abbrev: str | null
  headshot_url: str | null
  stats: list[MlbPlayerOfTheGameStat]   # showcase from scrape
  source: "mlb_player_of_the_game"

MlbPlayerOfTheGameStat:
  label: str | null       # optional (e.g. "HR"); null if scrape is a freeform line
  value: str              # display-ready
```

If the scrape only returns a single freeform line, map to one stat with `label: null` and `value: "<line>"`.

Frontend view: `playerOfTheGame` with camelCase fields.

### Cache

- Key: `gamePk` (string/int consistent with route)
- Store: normalized winner schema after successful fetch
- Location: follow existing backend cache conventions when present (file under `data/` or in-process + file); durable enough to survive process restart
- Positive hit: permanent for that `gamePk` (fan-vote winner does not change once published) — skip network
- Miss / upstream error: return null and do **not** write a permanent negative cache (a later request may refetch once voting closes)

### Soft-fail

`_attach_player_of_the_game` must catch all exceptions / timeouts and leave `player_of_the_game=null`. Game detail response otherwise unchanged.

## Out of scope

- Showing nominees or “voting in progress”
- Separate public POTG endpoint
- Background cron-only scraper (hybrid on-demand is the fetch model)
- Replacing W/L/S decisions on the linescore card
- Non-Final statuses
- Changing Play feed internals beyond insertion order

## Testing

- Provider: parse winner → schema; network/parse failure → null; cache hit skips fetch
- Mapper: `player_of_the_game` → `playerOfTheGame`
- `MlbPlayerOfTheGame`: renders headshot, boxed title, name, stats when present; renders nothing when null
- `MlbFinalCenter`: when present, POTG appears above Play feed

## Open implementation note

Exact Genius Sports / MLB Play winner HTTP shape (auth headers, contest id vs `gamePk`/`feedId`) must be confirmed during implementation by probing a completed contest. Design requires resolving `gamePk` → winner player identity. Showcase `stats` come only from the POTG scrape payload — do **not** invent boxscore-derived stats. If the winner is known but the scrape has no showcase line, still render the card with headshot / label / name and omit the stats row.
