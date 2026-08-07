# MLB ProphetX public API scraper (props + team JSON)

Date: 2026-08-05  
Status: Approved for planning

## Goal

Add `src/scrapers/mlb_prophetx.py`: an MLB-only ProphetX scraper that hits the same public JSON endpoints the website uses (no Selenium, no partner API key), writing separate props and team snapshot files.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `mlb_prophetx.py` via public HTTP APIs (`requests`) |
| League | `mlb` only (tournament id `109`) |
| Markets | Team moneyline / run line / total **and** allowlisted player props |
| Lines | **Player props:** main + alts with `is_main` (see `2026-08-06-mlb-prophetx-alt-lines-design.md`); **team markets:** main/favourite only |
| Odds depth | Best (top-of-book) American odds **plus** available `stake` |
| Output split | `*_props.json` and `*_team.json` |
| Auth | None required for public `/trade/public/...` and `/partner/v3/public/...` |
| Supabase / API / frontend | Out of scope for v1; leave a clear stub hook for a future loader |

## Architecture

```
mlb_prophetx.py (requests)
  → GET /trade/public/api/v1/tournaments/109/events  (paginate via `next`)
  → batch GET /partner/v3/public/get_multiple_markets
       • team: market_types=moneyline,spread,total
       • props: market_sub_types=<allowlist>
       • period team: 1st_inning_moneyline, 1st_5th_inning_moneyline → team file
  → props: all usable marketLines with is_main; team: favourite (main) line only
  → best odds + stake per side
  → write:
       data/props/prophetx/mlb/prophetx_mlb_{YYYY-MM-DD}_{HHMMSS}_props.json
       data/props/prophetx/mlb/prophetx_mlb_{YYYY-MM-DD}_{HHMMSS}_team.json
```

Entry: `python -m src.scrapers.mlb_prophetx`

Env knobs:

- `PROPHETX_OUTPUT` — full path to a `.json` file (team path derived via `_props` → `_team`), or a directory
- `PROPHETX_OUTPUT_DIR` — directory; timestamped filenames appended
- `PROPHETX_MAX_EVENTS` — optional cap on events per run
- `LOG_LEVEL` — logging verbosity

Default timezone for filenames: America/Los_Angeles (same as Underdog/Pinnacle).

Base host: `https://www.prophetx.co` (same public surface as the SPA). Requests send a normal browser User-Agent and `Accept: application/json`; team/config calls that need it may send `X-Currency: cash`.

## Discovery and markets

1. **Events:** paginate `GET /trade/public/api/v1/tournaments/109/events` until `next` is null. Each event yields id, name, scheduled time, status, competitors.
2. **Team markets:** batch event ids into `GET /partner/v3/public/get_multiple_markets?market_types=moneyline,spread,total&event_ids=…`.
3. **Player props:** same endpoint with `market_sub_types=` allowlist (comma-separated). Unknown subtypes are never requested; if the API returns an unexpected subtype, skip it.
4. **Line selection:** **Player props** — emit every usable `marketLine`; set `is_main` from `favourite` (sole line → true; multiple favourites → first main, rest alt). **Team markets** — keep the `favourite` line (or sole line); skip alts. Moneyline often exposes top-level `selections` with no `marketLines` — treat that as the main book directly.
5. **Best price:** for each over/under (or home/away) side, take the first / best resting selection’s American `odds` / `displayOdds` and its `stake`. Do not dump the full order book.

Batch size should be modest (e.g. ~20 event ids) with short retries on HTTP 429 / 5xx.

## Player prop allowlist

| ProphetX `subType` | JSON `stat` |
| --- | --- |
| `player_total_hits` | `hits` |
| `player_total_home_runs` | `home_runs` |
| `player_total_rbis` | `rbis` |
| `player_total_runs` | `runs` |
| `player_total_bases` | `total_bases` |
| `player_stolen_bases` | `stolen_bases` |
| `player_singles` | `singles` |
| `player_doubles` | `doubles` |
| `player_hits_allowed` | `hits_allowed` |

Extend the map only when live payloads confirm additional subtypes. Period moneylines (`1st_inning_moneyline`, `1st_5th_inning_moneyline`) go in the **team** file, not props.

## Output payload

Shared base fields on both files: `source` (`prophetx`), `fetched_at`, `league` (`mlb`), `tournament_id` (`109`), `snapshot_kind`, `games`.

**Team** (`snapshot_kind: "team"`): each game has event metadata plus `team_markets` for moneyline / run_line (spread) / total (and period moneylines when present). Each side: label/team, `american`, `line` (null on moneyline), `stake`.

**Props** (`snapshot_kind: "props"`): each game has the same event metadata plus `props[]` rows: `player`, `stat`, `line`, `over` / `under` (each with `american` + `stake`), `market_id`, `sub_type`, `is_main`.

Empty slate still writes both files with `games: []`.

## Errors

- HTTP / parse failures: log and raise after retries for transient statuses.
- Missing favourite when multiple team lines exist: skip market, debug log. Prop alts without selections are skipped.
- Unknown / unmapped prop subtype: skip.
- Supabase stub: a no-op or clearly `NotImplemented` hook named for a future `load_prophetx_snapshot` — do not call a real loader in v1.

## Tests

Unit tests with fixture JSON for event list + market payloads covering:

- Event pagination helper (multi-page `next`)
- Prop main + alt lines with `is_main`; team main-line / favourite selection
- Team market extraction (moneyline, spread, total)
- Prop extraction for allowlisted subtypes
- Output path naming (`_props` / `_team`)

No live network calls in CI.

## Out of scope

- Partner / affiliate API authentication
- Selenium or browser automation
- Full order book; team-market alternate (non-favourite) lines
- Supabase migrations, snapshot loaders, backend attach, frontend Prop Picks
- Non-MLB leagues / tournaments
- Changing Underdog / PrizePicks / Pinnacle scrapers

## Success criteria

1. `python -m src.scrapers.mlb_prophetx` scrapes MLB and writes both timestamped JSON files under `data/props/prophetx/mlb/`.
2. Props file has main + alt allowlisted player props (`is_main` flagged) with best american odds + stake.
3. Team file has main moneyline / run line / total (and period moneylines when present).
4. Unit tests pass without hitting ProphetX live.
5. Env path overrides mirror Pinnacle conventions under the `prophetx` / `mlb` folder.
