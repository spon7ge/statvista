# MLB Pinnacle Selenium scraper (props + team JSON)

Date: 2026-08-03  
Status: Approved for planning

## Goal

Add `src/scrapers/mlb_pinnacle.py`: a Selenium Pinnacle scraper for **MLB only**, behavior-matched to `wnba_pinnacle.py`, writing separate props and team snapshot files.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Clone WNBA scraper into a dedicated MLB file (no shared refactor) |
| League | `mlb` only |
| Sport path | `/en/baseball/mlb/...` (not basketball) |
| Player props | Broad Arcadia `units` → snake_case map; unknown units skipped |
| Team markets | `moneyline`, `spread`, `total` (same shape as WNBA) |
| Output split | `*_props.json` and `*_team.json` |
| Supabase / API / frontend | Out of scope |

## Architecture

```
mlb_pinnacle.py (Selenium)
  → open https://www.pinnacle.com/en/baseball/mlb/matchups/#all
  → discover game URLs via Arcadia /leagues/{id}/matchups (DOM fallback)
  → per game: decode related + straight Arcadia payloads from Chrome
  → write:
       data/props/pinnacle/mlb/pinnacle_mlb_{YYYY-MM-DD}_{HHMMSS}_props.json
       data/props/pinnacle/mlb/pinnacle_mlb_{YYYY-MM-DD}_{HHMMSS}_team.json
```

Same worker/parallelism and `PINNACLE_*` env knobs as WNBA (timeouts, workers, odds format, max games, output overrides).

## URL and discovery

- List page: `https://www.pinnacle.com/en/baseball/mlb/matchups/#all`
- Game URL pattern: `/en/baseball/mlb/{slug}/{matchup_id}/#all`
- Canonicalize with sport segment `baseball` and league `mlb`
- `LEAGUE_ARCADIA_IDS["mlb"]`: a hard-coded Arcadia league id (same pattern as NBA `487` / WNBA `578`). Implementation must confirm the id from a live `/sports/{sportId}/leagues` (or list-page) capture before treating discovery as done. If the constant is wrong or Arcadia list is empty, discovery falls back to DOM anchors exactly like WNBA.

## Player prop units (broad map)

Arcadia special-market `units` strings map to stable JSON `stat` keys. At minimum include (extend if live payloads show more known units):

| Arcadia `units` (examples) | JSON `stat` |
| --- | --- |
| Hits | `hits` |
| Home Runs | `home_runs` |
| Total Bases | `total_bases` |
| RBIs / Runs Batted In | `rbis` |
| Runs | `runs` |
| Stolen Bases | `stolen_bases` |
| Strikeouts | `strikeouts` |
| Hits Allowed | `hits_allowed` |
| Walks | `walks` |
| Earned Runs | `earned_runs` |
| Outs Recorded | `outs_recorded` |
| Pitcher Outs | `pitcher_outs` |

Unknown `units` are skipped (not written). Prop row shape matches WNBA: `stat`, `player`, `line`, `market_id`, American/decimal over-under per `PINNACLE_ODDS_FORMAT`.

## Team markets

Same extraction as WNBA from straight Arcadia rows for the game matchup id: moneyline / spread / total, grouped by period (`0` = full game). Snapshot strips `props` for team file and `team_markets` for props file.

## Output payload

Shared base fields with WNBA snapshots (`league`, scrape timestamps, `list_page`, `games`, etc.). Each file sets `snapshot_kind` to `"props"` or `"team"`.

Default directory: `data/props/pinnacle/mlb/`.  
`PINNACLE_OUTPUT` / `PINNACLE_OUTPUT_DIR` behave as in WNBA (team path derived from props path via `_props` → `_team`).

## Out of scope

- DB migrations / `odds.mlb_pinnacle*` tables
- Snapshot loaders and backend attach
- Frontend Prop Picks or matchup cards
- Changing `wnba_pinnacle.py`

## Success criteria

1. `python -m src.scrapers.mlb_pinnacle` (or equivalent module entry) scrapes MLB and writes both JSON files.
2. Props file has player lines for mapped units; team file has moneyline/spread/total when Arcadia provides them.
3. Paths and env overrides mirror WNBA conventions under the `mlb` league folder.
