# WNBA Novig public scrape (props + team JSON + Supabase)

Date: 2026-08-09  
Status: Approved for planning

## Goal

Add `src/scrapers/wnba_novig.py`: a WNBA-only Novig scraper that mirrors the current `mlb_novig.py` twin (ProphetX-shaped JSON + optional Supabase upsert). Prefer unauthenticated `requests` against Novig GraphQL; Selenium CDP fallback remains env-gated and stubbed until implemented. Write separate props and team snapshot JSON files, then upsert into `odds.wnba_novig` / `odds.wnba_novig_team` unless `NOVIG_SKIP_DB` is set.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `wnba_novig.py` (MLB twin); shared Novig client deferred |
| Transport | `requests` GraphQL first → Selenium CDP fallback only if `NOVIG_ALLOW_SELENIUM` (stub today, same as MLB) |
| League | `wnba` only (`game.league._eq: "WNBA"`) |
| Markets | Team moneyline / spread / total **and** allowlisted player props (core + extras when offered) |
| Quote | Best **available** (bettable) price + liquidity as `stake`; not last trade |
| Output split | `*_props.json` and `*_team.json` under `data/props/novig/wnba/` |
| Auth | Unauthenticated public GraphQL only |
| Supabase | In scope: migrations + league-routed loader upserts |
| Frontend / Odds API replacement | Out of scope |

## Architecture

```
wnba_novig.py
  → GraphQL https://api.novig.us/v1/graphql
  → List OPEN_PREGAME / OPEN_INGAME WNBA events
  → Fetch markets per event with outcomes + available / OPEN CASH orders
  → Normalize → ProphetX-shaped props + team game snapshots
  → write:
       data/props/novig/wnba/novig_wnba_{YYYY-MM-DD}_{HHMMSS}_props.json
       data/props/novig/wnba/novig_wnba_{YYYY-MM-DD}_{HHMMSS}_team.json
  → upsert odds.wnba_novig / odds.wnba_novig_team (unless NOVIG_SKIP_DB)
  → On hard failure or zero usable markets: optional Selenium path
       (NOVIG_ALLOW_SELENIUM=1) — stub raises until CDP capture exists
```

Entry: `python -m src.scrapers.wnba_novig`

Env knobs (shared with MLB Novig):

- `NOVIG_OUTPUT` — full path to a `.json` file (team path derived via `_props` → `_team`), or a directory
- `NOVIG_OUTPUT_DIR` — directory; timestamped filenames appended
- `NOVIG_MAX_EVENTS` — optional cap on events per run
- `NOVIG_ALLOW_SELENIUM` — enable browser fallback (`1` / truthy)
- `NOVIG_SKIP_DB` — skip Supabase upsert when set
- `LOG_LEVEL` — logging verbosity

Default timezone for filenames: America/Los_Angeles (same as ProphetX / Underdog / Pinnacle / MLB Novig).

Exact Novig `type` strings for basketball props are confirmed during implementation against live WNBA market payloads; the allowlist below is the target set.

## Discovery and markets

1. **Events:** fetch WNBA events with status in `{OPEN_PREGAME, OPEN_INGAME}` (paginated if needed; inline-query fallback if variables fail — same pattern as MLB). Capture id, description, scheduled start, status, home/away teams.
2. **Markets:** for each event, load markets + outcomes. Use bettable `available`; OPEN CASH `orders.qty` on the opposite outcome → `stake` (cents → dollars).
3. **Team vs props:** Team: `MONEY` → `moneyline`, main `SPREAD` → `spread`, main `TOTAL` → `total`. Props: player-linked markets mapped via allowlist. Do **not** emit MLB `run_line`; basketball uses `spread`.
4. **Main lines:** props — evenness among same player+stat (`is_main`). Team spread/total — evenness among two-sided available markets (no 1.5 run-line bias).
5. **Best price:** probability `available` → American. Do not use `last` as primary quote. Skip sides with no available price.
6. **Order-book nuance:** bids on one side are liquidity for the opposite outcome — same helper logic as MLB; cover with fixture unit tests.

Retries on HTTP 429 / 5xx with short backoff. Cap events via `NOVIG_MAX_EVENTS`.

## Player prop allowlist

Map Novig market `type` keys onto canonical `stat` keys. Start with ProphetX WNBA core; include extras when live payloads confirm them:

| Canonical `stat` | Likely Novig `type` (confirm live) |
| --- | --- |
| `points` | POINTS / PLAYER_POINTS |
| `rebounds` | REBOUNDS |
| `assists` | ASSISTS |
| `points_rebounds_assists` | PRA / POINTS_REBOUNDS_ASSISTS |
| `points_rebounds` | POINTS_REBOUNDS |
| `points_assists` | POINTS_ASSISTS |
| `rebounds_assists` | REBOUNDS_ASSISTS |
| `threes` | THREES / THREE_POINTERS |
| `steals` | STEALS |
| `blocks` | BLOCKS |
| `steals_blocks` | STEALS_BLOCKS (if offered) |
| `turnovers` | TURNOVERS (if offered) |

Extend the map only when live payloads confirm additional markets. Unmapped markets are skipped (DEBUG log).

## Output payload

Shared base fields on both files: `source` (`novig`), `fetched_at`, `league` (`wnba`), `snapshot_kind`, `games`.  
Omit `tournament_id` unless Novig exposes a clear equivalent — do not invent one.

**Team** (`snapshot_kind: "team"`): each game has event metadata plus `team_markets` for `moneyline` / `spread` / `total`. Each side: label/team, `american`, `line` (null on moneyline), `stake`, `competitor_id` when known.

**Props** (`snapshot_kind: "props"`): each game has the same event metadata plus `props[]` rows: `player`, `stat`, `line`, `over` / `under` (each with `american` + `stake`), `market_id`, `sub_type` (stable slug from Novig market type), `is_main`.

Empty slate still writes both files with `games: []` when discovery succeeds.

## Database and loader

Migrations (next numbers after `034`):

- `odds.wnba_novig` — mirror `odds.mlb_novig` (TEXT UUID `event_id` / `market_id`, same unique index on league/event/player/stat/side/line/scraped_at)
- `odds.wnba_novig_team` — mirror `odds.mlb_novig_team` (same unique index shape)

Loader changes in `src/odds/load_snapshots.py`:

- `load_novig_props_snapshot` / `load_novig_team_snapshot` route table by `league`:
  - `mlb` → `mlb_novig` / `mlb_novig_team`
  - `wnba` → `wnba_novig` / `wnba_novig_team`
- Keep shared row mappers (`novig_props_to_rows` / `novig_team_to_rows`); they already accept `league`.
- Scraper calls loaders with `league="wnba"` after writing JSON (same pattern as MLB).

## Errors

- HTTP / parse failures: log and raise after retries for transient statuses on the primary path.
- Primary path blocked or yields zero usable markets: if `NOVIG_ALLOW_SELENIUM=1`, attempt Selenium capture; otherwise exit non-zero with a clear message.
- Missing available price on a side: omit that side (or skip the prop row if both sides empty).
- Unknown / unmapped prop markets: skip.
- Supabase upsert failure: log error; keep written JSON files.

## Tests

Unit tests in `src/scrapers/tests/scrapers/test_wnba_novig.py` with fixture payloads (no live network in CI):

- Output path naming (`novig_wnba_…_props.json` / `_team`)
- Probability → American conversion
- Prop extraction (over/under, line, broader stat map, `is_main`)
- Team moneyline / spread / total extraction (not `run_line`)
- Skip unmapped markets and sides without `available`
- Bid/opposite-side liquidity → `stake` when applicable

Loader/unit coverage for league → table routing (`mlb` vs `wnba`) where tests already cover Novig loaders, or a focused addition alongside them.

## Out of scope

- Official Novig trading OAuth / API keys
- Shared `novig_common` client refactor
- Frontend changes; replacing Odds API Novig quotes in the UI
- Full order book dump; last-trade as primary quote
- Non-WNBA leagues in this scraper
- Always-on Selenium / implementing CDP capture in this pass

## Success criteria

1. `python -m src.scrapers.wnba_novig` scrapes WNBA and writes both timestamped JSON files under `data/props/novig/wnba/` when GraphQL works.
2. Props file has allowlisted player props (core + extras when present) with best available american odds + stake (when liquidity known).
3. Team file has main moneyline / spread / total when quoted.
4. Migrations create `odds.wnba_novig` and `odds.wnba_novig_team`; scraper upserts when DB is configured and `NOVIG_SKIP_DB` is unset.
5. Unit tests pass without live network; Selenium path remains optional and env-gated.
