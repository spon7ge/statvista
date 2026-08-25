# Odds/props scraper runner

## Goal

One CLI that runs all WNBA/MLB **odds/props** scrapers sequentially, including PrizePicks.

## Non-goals

- RotoWire / lineup scrapers
- Parallel scraper execution
- Changing individual scraper behavior

## Design

- **File:** `src/scrapers/run_all_odds.py`
- **Entry:** `python -m src.scrapers.run_all_odds`
- **Mechanism:** subprocess per module (`python -m src.scrapers.<name>`) so Selenium/env state does not bleed
- **Continue on failure** by default; print pass/fail summary; exit `1` if any failed
- **Flags:** `--league wnba|mlb|all` (default `all`), `--only name,…`, `--fail-fast` (stop on first failure)

### Included (order)

| League | Module | Notes |
|--------|--------|--------|
| WNBA | `wnba_novig` | |
| WNBA | `wnba_prophetx` | |
| WNBA | `wnba_underdog` | |
| WNBA | `bball_pinnacle` | env `PINNACLE_LEAGUES=wnba` for that step |
| WNBA | `wnba_prizepick` | last so DataDome/browser fallback does not block HTTP scrapers |
| MLB | `mlb_novig` | |
| MLB | `mlb_prophetx` | |
| MLB | `mlb_underdog` | |
| MLB | `mlb_pinnacle` | |
| MLB | `mlb_prizepick` | last so DataDome/browser fallback does not block HTTP scrapers |

## Tests

- Unit test: resolve job list for `--league` / `--only` without launching scrapers
