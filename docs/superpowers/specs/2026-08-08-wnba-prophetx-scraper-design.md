# WNBA ProphetX public API scraper (props + team JSON)

Date: 2026-08-08  
Status: Approved for planning  
Related: `2026-08-05-mlb-prophetx-scraper-design.md`, `2026-08-06-mlb-prophetx-alt-lines-design.md`

## Goal

Add `src/scrapers/wnba_prophetx.py`: a WNBA-only ProphetX scraper that hits the same public JSON endpoints as `mlb_prophetx.py` (no Selenium, no partner API key), writing separate props and team snapshot files under `data/props/prophetx/wnba/`.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `wnba_prophetx.py` via public HTTP APIs (`requests`), mirroring MLB layout |
| League | `wnba` only (tournament id `1600000176`, discovered from ProphetX tournament list name `WNBA`) |
| Markets | Full-game team moneyline / spread / total **and** allowlisted player props (singles + combos) |
| Period markets | Out of scope (no first-half / quarter team markets in v1) |
| Lines | **Player props:** main + alts with `is_main` (same rules as MLB alt-lines); **team markets:** main/favourite only |
| Odds depth | Best (top-of-book) American odds **plus** available `stake` |
| Output split | `*_props.json` and `*_team.json` |
| Auth | None required for public `/trade/public/...` and `/partner/v3/public/...` |
| Supabase / API / frontend | Out of scope for v1; stub or log-only hook — do **not** upsert into `odds.mlb_prophetx*` |

## Architecture

```
wnba_prophetx.py (requests)
  → GET /trade/public/api/v1/tournaments/1600000176/events  (paginate via `next`)
  → batch GET /partner/v3/public/get_multiple_markets
       • team: market_types=moneyline,spread,total
       • props: market_sub_types=<allowlist>
  → props: all usable marketLines with is_main; team: favourite (main) line only
  → best odds + stake per side
  → write:
       data/props/prophetx/wnba/prophetx_wnba_{YYYY-MM-DD}_{HHMMSS}_props.json
       data/props/prophetx/wnba/prophetx_wnba_{YYYY-MM-DD}_{HHMMSS}_team.json
```

Entry: `python -m src.scrapers.wnba_prophetx`

Env knobs (same names as MLB for consistency):

- `PROPHETX_OUTPUT` — full path to a `.json` file (team path derived via `_props` → `_team`), or a directory
- `PROPHETX_OUTPUT_DIR` — directory; timestamped filenames appended
- `PROPHETX_MAX_EVENTS` — optional cap on events per run
- `LOG_LEVEL` — logging verbosity

Default timezone for filenames: America/Los_Angeles.

Base host: `https://www.prophetx.co`. Requests send a normal browser User-Agent, `Accept: application/json`, and `X-Currency: cash`.

## Discovery and markets

1. **Events:** paginate `GET /trade/public/api/v1/tournaments/1600000176/events` until `next` is null. Each event yields id, name, scheduled time, status, competitors.
2. **Team markets:** batch event ids into `GET /partner/v3/public/get_multiple_markets?market_types=moneyline,spread,total&event_ids=…`.
3. **Player props:** same endpoint with `market_sub_types=` allowlist (comma-separated). Unknown subtypes are never requested; if the API returns an unexpected subtype, skip it.
4. **Line selection:** **Player props** — emit every usable `marketLine`; set `is_main` from `favourite` (sole line → true; multiple favourites → first main, rest alt). **Team markets** — keep the `favourite` line (or sole line); skip alts. Moneyline often exposes top-level `selections` with no `marketLines` — treat that as the main book directly.
5. **Best price:** for each over/under (or home/away) side, take the first / best resting selection’s American odds and its `stake`. Do not dump the full order book.

Batch size should be modest (e.g. ~20 event ids) with short retries on HTTP 429 / 5xx.

Tournament id was confirmed live (2026-08-08): list entry name `WNBA` → id `1600000176` with game events; `New WNBA` (`1600000155`) had zero events and is not used.

## Team market map

| ProphetX `subType` / type | JSON key |
| --- | --- |
| `moneyline` | `moneyline` |
| `spread` | `spread` |
| `total` | `total` |

Use basketball-native `spread` (not MLB’s `run_line`).

## Player prop allowlist

Confirmed against live `get_multiple_markets` for WNBA event ids (2026-08-08):

| ProphetX `subType` | JSON `stat` |
| --- | --- |
| `player_total_points` | `points` |
| `player_total_rebounds` | `rebounds` |
| `player_total_assists` | `assists` |
| `player_total_points_rebounds_assists` | `points_rebounds_assists` |
| `player_total_points_rebounds` | `points_rebounds` |
| `player_total_points_assists` | `points_assists` |
| `player_total_rebounds_assists` | `rebounds_assists` |

Player-name suffixes stripped from market `name` follow the same pattern as MLB (e.g. ` Total Points`, ` Total Points, Rebounds & Assists`).

Extend the map only when live payloads confirm additional subtypes (e.g. threes / steals / blocks were not present in the discovery sample).

## Output payload

Shared base fields on both files: `source` (`prophetx`), `fetched_at`, `league` (`wnba`), `tournament_id` (`1600000176`), `snapshot_kind`, `games`.

**Team** (`snapshot_kind: "team"`): each game has event metadata plus `team_markets` for moneyline / spread / total. Each side: label/team, `american`, `line` (null on moneyline), `stake`.

**Props** (`snapshot_kind: "props"`): each game has the same event metadata plus `props[]` rows: `player`, `stat`, `line`, `over` / `under` (each with `american` + `stake`), `market_id`, `sub_type`, `is_main`.

Empty slate still writes both files with `games: []`.

## Errors

- HTTP / parse failures: log and raise after retries for transient statuses.
- Missing favourite when multiple team lines exist: skip market, debug log. Prop alts without selections are skipped.
- Unknown / unmapped prop subtype: skip.
- Supabase: no-op / stub only in v1 — do not call `load_prophetx_*` against MLB tables.

## Tests

Unit tests in `src/scrapers/tests/scrapers/test_wnba_prophetx.py` with fixture JSON covering:

- Output path naming (`prophetx_wnba_…_props.json` / `_team`, default dir `…/prophetx/wnba`)
- Team market extraction (moneyline, spread, total — key `spread`)
- Prop extraction for allowlisted subtypes including combos
- Prop main + alt lines with `is_main`
- Snapshot build wiring for `league=wnba` / tournament id

No live network calls in CI.

## Out of scope

- Partner / affiliate API authentication
- Selenium or browser automation
- Full order book; team-market alternate (non-favourite) lines
- First-half / quarter team markets
- Supabase migrations, snapshot loaders, backend attach, frontend Prop Picks
- Shared refactor extracting common code with `mlb_prophetx.py`
- NBA or other basketball tournaments

## Success criteria

1. `python -m src.scrapers.wnba_prophetx` scrapes WNBA and writes both timestamped JSON files under `data/props/prophetx/wnba/`.
2. Props file has main + alt allowlisted player props (`is_main` flagged) with best american odds + stake, including combo stats when offered.
3. Team file has main moneyline / spread / total only (no period markets).
4. Unit tests pass without hitting ProphetX live.
5. Env path overrides work the same way as MLB under the `prophetx` / `wnba` folder.
