# Odds/props scraper runner

## Goal

One CLI that runs all WNBA/NBA/MLB **odds/props** scrapers sequentially, including PrizePicks.

## Non-goals

- RotoWire / lineup scrapers
- Parallel scraper execution
- Changing individual scraper behavior

## Design

- **File:** `src/scrapers/run_all_odds.py`
- **Entry:** `python -m src.scrapers.run_all_odds`
- **Mechanism:** subprocess per module (`python -m src.scrapers.<league>.<name>`) so Selenium/env state does not bleed
- **Continue on failure** by default; print pass/fail summary; exit `1` if any failed
- **Flags:** `--league wnba|nba|mlb|all` (default `all`), `--only name,…`, `--fail-fast` (stop on first failure)

### Included (order)

HTTP books run before Pinnacle and PrizePicks. PrizePicks is last per league so a DataDome/browser fallback does not block the HTTP scrapers.

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
