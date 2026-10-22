# Odds/props scraper runner

## Goal

One CLI that runs WNBA/NBA/MLB **odds/props** scrapers. HTTP books run together. Pinnacle and PrizePicks run after that wave, one at a time.

## Non-goals

- RotoWire / lineup scrapers
- Changing individual scraper behavior

## Design

- **File:** `src/scrapers/run_all_odds.py`
- **Entry:** `python -m src.scrapers.run_all_odds`
- **Mechanism:** subprocess per module (`python -m src.scrapers.<league>.<name>`) so Selenium/env state does not bleed
- **Waves:** every selected HTTP book starts together. After that wave finishes, Pinnacle and PrizePicks run one at a time, in catalog order, so browser/DataDome work does not start while the HTTP scrapers are still running
- **Continue on failure** by default; print pass/fail summary; exit `1` if any failed
- **Flags:** `--league wnba|nba|mlb|all` (default `all`), `--only name,…`, `--exclude name,…`, `--fail-fast` (after the HTTP wave, skip Pinnacle and PrizePicks if any HTTP book failed; during the browser wave, stop before the next browser scraper)

### Included (order)

HTTP books share the first wave. Pinnacle and PrizePicks are the second wave.

| League | Module | Notes |
|--------|--------|--------|
| WNBA | `src.scrapers.wnba.wnba_novig` | |
| WNBA | `src.scrapers.wnba.wnba_prophetx` | |
| WNBA | `src.scrapers.wnba.wnba_underdog` | |
| WNBA | `src.scrapers.wnba.wnba_draftking` | |
| WNBA | `src.scrapers.wnba.wnba_fanduel` | |
| WNBA | `src.scrapers.wnba.wnba_pinnacle` | job name `bball_pinnacle`; env `PINNACLE_LEAGUES=wnba` |
| WNBA | `src.scrapers.wnba.wnba_prizepick` | last in the WNBA group |
| NBA | `src.scrapers.nba.nba_novig` | |
| NBA | `src.scrapers.nba.nba_prophetx` | |
| NBA | `src.scrapers.nba.nba_underdog` | |
| NBA | `src.scrapers.nba.nba_draftking` | |
| NBA | `src.scrapers.nba.nba_fanduel` | |
| NBA | `src.scrapers.nba.nba_pinnacle` | |
| NBA | `src.scrapers.nba.nba_prizepick` | last in the NBA group |
| MLB | `src.scrapers.mlb.mlb_novig` | |
| MLB | `src.scrapers.mlb.mlb_prophetx` | |
| MLB | `src.scrapers.mlb.mlb_underdog` | |
| MLB | `src.scrapers.mlb.mlb_draftking` | |
| MLB | `src.scrapers.mlb.mlb_fanduel` | |
| MLB | `src.scrapers.mlb.mlb_pinnacle` | |
| MLB | `src.scrapers.mlb.mlb_prizepick` | last in the MLB group |

## Tests

- Unit test: resolve job list for `--league` / `--only` without launching scrapers
