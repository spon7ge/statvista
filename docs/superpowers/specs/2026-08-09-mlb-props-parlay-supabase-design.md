# MLB props: Parlay (PP/DK/FD) + Supabase scrapers (no Odds API)

Date: 2026-08-09  
Status: Approved for planning

## Goal

Stop using The Odds API for MLB player props. Seed PrizePicks / DraftKings / FanDuel from **ParlayAPI** (those three books only). Attach **ProphetX**, **Novig**, and **Pinnacle** from **latest Supabase scraper snapshots**. Apply across all MLB props surfaces (`/api/mlb/props/today` and game-preview props).

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Rewire assemble — Parlay + Supabase; drop Odds API from MLB props |
| Parlay books | `prizepicks`, `draftkings`, `fanduel` only |
| Supabase books | `prophetx` (`odds.mlb_prophetx`), `novig` (`odds.mlb_novig`), `pinnacle` (`odds.mlb_pinnacle`) |
| Underdog board | Unchanged — scraper → `odds.mlb_underdogs` |
| Dropped live books | `kalshi`, `betmgm`, `betonline` (schema fields removed) |
| Tier 1 | ProphetX + Novig equal avg (no Kalshi) |
| Tier 2 | DraftKings + FanDuel (Parlay) |
| Soft Consensus | `SOFT_FAIR_BOOKS = ("pinnacle",)`; fire only when **≥2** soft books present (dormant until a second soft book is added) |
| Scope | Entire MLB props stack (league board + game preview props) |
| Odds API code | Unused by MLB props; no live calls (may remain in repo) |

## Architecture

```
GET /api/mlb/props/today?app=&format=&legs=
  → board seed:
       app=prizepicks → Parlay prizepicks rows (normalized DFS board)
       app=underdog   → Supabase mlb_underdogs
  → indexes:
       Parlay draftkings + fanduel (exact line)
       Supabase latest: prophetx, novig, pinnacle
  → compute_fair → edge → recommend side → ESPN enrich → sort

GET game preview props
  → same Parlay + Supabase book indexes (no Odds API)
```

New helper: `fetch_latest_novig("mlb")` in `backend/app/core/odds_snapshots.py` (mirror ProphetX/Pinnacle latest-snapshot fetch).

Thin MLB Parlay fetch/normalize module (reuse `providers/parlay/client.py`, MLB sport + market allowlist, strip books outside the three allowlisted).

## Fair ladder

| Tier | Books | Rule | `source_tier` |
| --- | --- | --- | --- |
| **1** | ProphetX, Novig | Equal average of present exact-line fair % | `sharp_consensus` (2+), `sharp_single_source` (1) |
| **2** | DraftKings, FanDuel | Existing mid-tier fallback | `mid_tier_fallback` |
| Soft | Pinnacle (+ future soft books) | Equal avg only if **≥2** soft books present | `soft_consensus` |
| — | none | | `no_sharp_read` |

Pinnacle expand quotes keep `role="comparison"`. Soft Consensus does not fire on Pinnacle alone.

## Schema / UI

`MlbPropBooks` retains: `prophetx`, `novig`, `draftkings`, `fanduel`, `pinnacle`.  
Remove: `kalshi`, `betmgm`, `betonline`.

Sync OpenAPI golden, frontend expand labels, and footer copy (no Odds API / Kalshi soft-book wording).

Update `md/system-design.md` page ↔ API table for `/mlb/prop_picks` and game props.

## Errors

| Condition | Behavior |
| --- | --- |
| Parlay HTTP / key failure | Soft-fail; `error` includes stable `parlay_unavailable`; Underdog path still works |
| Empty Parlay slate | Empty PP board when `app=prizepicks`; no crash |
| Missing Supabase scraper tables / empty latest | Null book quotes; assemble continues |
| Soft Consensus with only Pinnacle | Falls through to `no_sharp_read` after Tier 1/2 miss |

Do **not** emit `odds_api_unavailable` from MLB props paths after this change.

## Tests

- `prop_fair`: Tier 1 without Kalshi; Soft Consensus requires ≥2 soft books; single Pinnacle → not soft_consensus
- `props.py` assemble: Parlay PP board + DK/FD indexes + PX/Novig/Pinnacle snapshots; Parlay fail still returns Underdog
- `game_props.py`: no Odds API mock; Parlay + scrapers
- `fetch_latest_novig` unit/skip-db style as existing snapshot helpers
- OpenAPI / schema field set matches shrunk books
- Frontend expand labels / tests updated for removed books

## Out of scope

- WNBA Parlay / Odds API changes
- Deleting `backend/app/providers/odds_api/` package
- Adding a second Soft Consensus book
- Cron / 15-minute scrape orchestration (scrapers already write Supabase)
- Replacing Underdog with Parlay

## Success criteria

1. No MLB props request calls The Odds API.
2. PrizePicks tab board comes from Parlay; DK/FD attach from Parlay exact line.
3. ProphetX / Novig / Pinnacle attach from latest Supabase snapshots.
4. Fair Tier 1 is PX+Novig; Soft Consensus dormant with Pinnacle alone.
5. Expand UI / OpenAPI show only the five retained books.
6. Targeted backend + frontend tests pass.
