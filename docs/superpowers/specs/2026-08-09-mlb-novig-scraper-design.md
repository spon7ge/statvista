# MLB Novig public scrape (props + team JSON)

Date: 2026-08-09  
Status: Approved for planning

## Goal

Add `src/scrapers/mlb_novig.py`: an MLB-only Novig scraper that mirrors the ProphetX scraper layout. Prefer unauthenticated `requests` against the same public JSON/GraphQL the Novig site (or odds-screen docs) expose; fall back to Selenium CDP capture only when that path fails. Write separate props and team snapshot JSON files. No Supabase upsert in v1.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `mlb_novig.py` (ProphetX twin); shared client deferred until more leagues |
| Transport | **C:** `requests` first → Selenium CDP fallback if blocked / empty / auth wall |
| League | `mlb` only |
| Markets | Team moneyline / run line / total **and** allowlisted player props |
| Quote | Best **available** (bettable) price + liquidity as `stake`; not last trade |
| Output split | `*_props.json` and `*_team.json` under `data/props/novig/mlb/` |
| Auth | No official trading API keys; unauthenticated public surface only |
| Supabase / Odds API / frontend | Out of scope for v1 (JSON files only) |

## Architecture

```
mlb_novig.py
  → Probe public GraphQL/REST (e.g. https://api.novig.us/v1/graphql or SPA XHRs)
  → List OPEN_PREGAME / OPEN_INGAME MLB events
  → Fetch markets per event (or batched) with outcomes + available / orders
  → Normalize → ProphetX-shaped props + team game snapshots
  → write:
       data/props/novig/mlb/novig_mlb_{YYYY-MM-DD}_{HHMMSS}_props.json
       data/props/novig/mlb/novig_mlb_{YYYY-MM-DD}_{HHMMSS}_team.json
  → On hard failure or zero usable markets: optional Selenium path
       (NOVIG_ALLOW_SELENIUM=1) capturing the same payloads, then same normalizer
```

Entry: `python -m src.scrapers.mlb_novig`

Env knobs:

- `NOVIG_OUTPUT` — full path to a `.json` file (team path derived via `_props` → `_team`), or a directory
- `NOVIG_OUTPUT_DIR` — directory; timestamped filenames appended
- `NOVIG_MAX_EVENTS` — optional cap on events per run
- `NOVIG_ALLOW_SELENIUM` — enable browser fallback (`1` / truthy)
- `LOG_LEVEL` — logging verbosity

Default timezone for filenames: America/Los_Angeles (same as ProphetX / Underdog / Pinnacle).

Exact endpoint URLs and query shapes are confirmed during implementation against live Novig responses (or captured SPA traffic). Prefer documented GraphQL odds-screen patterns when they work without a trading token; otherwise reverse-engineer the site’s public calls.

## Discovery and markets

1. **Events:** fetch MLB events with status in `{OPEN_PREGAME, OPEN_INGAME}` (paginated if needed). Capture id, description/name, scheduled start, status, competitors/teams when present.
2. **Markets:** for each event (or optimized batch), load markets + outcomes. Prefer fields that expose bettable `available` price; optionally pull open CASH orders for best-level `qty` → `stake`.
3. **Team vs props:** classify by market description / type / player association. Team: moneyline, run line (spread), total. Props: player-linked markets mapped via allowlist.
4. **Line / main:** when multiple lines exist for the same player+stat, mark a main line if Novig exposes an equivalent of favourite/main; otherwise treat the primary quoted line as `is_main: true` and others as alts when distinguishable. Team markets: main line only (skip obscure alts).
5. **Best price:** use `available` (probability or American as returned). Convert probability → American. Do not use `last` as the primary quote. `stake` from best-level liquidity in dollars when qty is available; else `null`. Skip sides with no available price.
6. **Order-book nuance:** Novig docs store bids on one side as liquidity on the opposite outcome — implement conversion carefully and cover with unit tests from fixture payloads.

Retries on HTTP 429 / 5xx with short backoff. Cap events via `NOVIG_MAX_EVENTS`.

## Player prop allowlist

Map Novig market descriptions (or type keys) onto the same `stat` keys as ProphetX when possible:

| Canonical `stat` | Typical Novig wording (confirm live) |
| --- | --- |
| `hits` | Hits / Total Hits |
| `home_runs` | Home Runs |
| `rbis` | RBIs / Runs Batted In |
| `runs` | Runs |
| `total_bases` | Total Bases |
| `stolen_bases` | Stolen Bases |
| `singles` | Singles |
| `doubles` | Doubles |
| `hits_allowed` | Hits Allowed |
| `strikeouts` | Strikeouts (pitcher) when clearly present |

Extend the map only when live payloads confirm additional markets. Unmapped markets are skipped (DEBUG log).

## Output payload

Shared base fields on both files: `source` (`novig`), `fetched_at`, `league` (`mlb`), `snapshot_kind`, `games`.  
Omit `tournament_id` unless Novig exposes a clear equivalent — do not invent one.

**Team** (`snapshot_kind: "team"`): each game has event metadata plus `team_markets` for `moneyline` / `run_line` / `total`. Each side: label/team, `american`, `line` (null on moneyline), `stake`, `competitor_id` when known.

**Props** (`snapshot_kind: "props"`): each game has the same event metadata plus `props[]` rows: `player`, `stat`, `line`, `over` / `under` (each with `american` + `stake`), `market_id`, `sub_type` (stable slug from Novig market type/description), `is_main`.

Empty slate still writes both files with `games: []` when discovery succeeds.

## Errors

- HTTP / parse failures: log and raise after retries for transient statuses on the primary path.
- Primary path blocked or yields zero usable markets: if `NOVIG_ALLOW_SELENIUM=1`, attempt Selenium capture; otherwise exit non-zero with a clear message.
- Missing available price on a side: omit that side (or skip the prop row if both sides empty).
- Unknown / unmapped prop markets: skip.
- No Supabase loader call in v1.

## Tests

Unit tests in `src/scrapers/tests/scrapers/test_mlb_novig.py` with fixture payloads (no live network in CI):

- Output path naming (`novig_mlb_…_props.json` / `_team`)
- Probability → American conversion
- Prop extraction (over/under, line, stat map, `is_main`)
- Team moneyline / run_line / total extraction
- Skip unmapped markets and sides without `available`
- Bid/opposite-side liquidity → `stake` when applicable

## Out of scope

- Official Novig trading OAuth / API keys
- Supabase migrations, snapshot loaders, replacing Odds API Novig quotes, frontend changes
- Full order book dump; last-trade as primary quote
- Non-MLB leagues
- Always-on Selenium (fallback only)

## Success criteria

1. `python -m src.scrapers.mlb_novig` scrapes MLB and writes both timestamped JSON files under `data/props/novig/mlb/` when the public path works.
2. Props file has allowlisted player props with best available american odds + stake (when liquidity known).
3. Team file has main moneyline / run line / total when quoted.
4. Unit tests pass without live network; Selenium path is optional and env-gated.
