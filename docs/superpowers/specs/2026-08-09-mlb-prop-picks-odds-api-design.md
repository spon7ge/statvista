# MLB prop picks: The Odds API over Parlay (PrizePicks board)

Date: 2026-08-09  
Status: Planned — see `docs/superpowers/plans/2026-08-09-mlb-prop-picks-odds-api.md`  
Parent: `docs/superpowers/specs/2026-08-05-mlb-prop-picks-design.md`  
Supersedes (MLB props serve path only): Parlay live books on `/api/mlb/props/today`; PrizePicks Supabase board seed  
Related: Soft Consensus `2026-08-08-mlb-prop-picks-soft-consensus-design.md` (Tier 3 membership updated here)  
API: [The Odds API](https://the-odds-api.com/)

## Goal

Replace **ParlayAPI** as the live sportsbook feed for MLB `/mlb/prop_picks` with **The Odds API**, and seed the **PrizePicks** app tab from Odds API `us_dfs` / `prizepicks` (scraper restricted). Keep **Underdog**, **ProphetX**, and **Pinnacle** from existing scrapers/Supabase snapshots.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Live Odds API provider on assemble path (Approach 1) |
| PrizePicks board | Odds API `prizepicks` under `us_dfs`; stop reading `odds.mlb_prizepicks` for serve |
| Underdog board | Unchanged — scraper → `odds.mlb_underdogs` |
| ProphetX / Pinnacle | Unchanged scrapers |
| Regions (v1) | `us`, `us_ex`, `us_dfs` only — **no `eu`** |
| US books | `betonlineag`, `betmgm`, `draftkings`, `fanduel` |
| US_EX books | `novig`, `kalshi` |
| US_DFS books | `prizepicks` (board only for PP tab) |
| Removed from MLB props | Caesars, bet365, Fanatics, Hard Rock, Fliff; Parlay entirely on this path |
| Tier 1 blend | Equal average of present exact-line quotes among ProphetX + Novig + Kalshi |
| Env | `THE_ODDS_API_KEY` (existing) |

## Architecture

```
GET /api/mlb/props/today?app=&format=&legs=
  → board seed:
       app=prizepicks → Odds API prizepicks (us_dfs)
       app=underdog   → Supabase mlb_underdogs
  → index ProphetX + Pinnacle snapshots (exact line)
  → fetch Odds API events + per-event player props
       regions us,us_ex,us_dfs
       bookmakers betonlineag,betmgm,draftkings,fanduel,novig,kalshi,prizepicks
  → compute_fair → edge → recommend side → ESPN enrich → sort
```

No new public endpoints. OpenAPI changes only for `MlbPropBooks` field set.

## Fair ladder

| Tier | Books | Rule | `source_tier` |
| --- | --- | --- | --- |
| **1** | ProphetX (scraper), Novig (Odds API), Kalshi (Odds API) | Equal average of whichever have exact-line fair % | `sharp_consensus` (2+), `sharp_single_source` (1) |
| **2** | DraftKings, FanDuel (Odds API) | Existing mid-tier rules (agree → DK lean; else DK or single) | `mid_tier_fallback` |
| **3 Soft Consensus** | BetMGM, BetOnline, Pinnacle (scraper) | Equal average when Tier 1+2 empty | `soft_consensus` |
| else | — | No fair | `no_sharp_read` |

Join remains **exact** `(player, stat, side, line)` — no closest-line.

Expand `role`:

- Fair-capable (no `comparison`): `prophetx`, `novig`, `kalshi`, `draftkings`, `fanduel`
- `comparison`: `betmgm`, `betonline`, `pinnacle` (still eligible for Tier 3)

## Schema / UI

`MlbPropBooks`:

- **Keep:** `prophetx`, `novig`, `draftkings`, `fanduel`, `kalshi`, `betmgm`, `pinnacle`
- **Add:** `betonline` (maps from Odds API `betonlineag`)
- **Remove:** `caesars`, `bet365`, `fanatics`, `hardrock`, `fliff`

Frontend `MlbPropPicksList` expand labels/cells match. PrizePicks / Underdog tabs and pagination unchanged.

## Odds API fetch

1. `GET https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=…`
2. For each event (concurrency-limited):  
   `GET …/events/{eventId}/odds?regions=us,us_ex,us_dfs&oddsFormat=american&bookmakers=betonlineag,betmgm,draftkings,fanduel,novig,kalshi,prizepicks&markets=<MLB prop allowlist>`
3. Map market keys → existing canonical MLB stat strings (hits, total bases, strikeouts, HR, RBI, runs, etc. — reuse / extend `prop_stat_keys` patterns).
4. PrizePicks outcomes → board rows for `app=prizepicks` (standard lines; skip alternate/demon/goblin markets unless already supported as standard).
5. Cache assembled board ~15 min per `(app, format, legs)`; client `useMlbProps` refetches on the same interval to spare Odds API quota.
6. Log `x-requests-remaining` / `x-requests-used` response headers; do not fail on low credits.

Credit note: player props are per-event; fan-out cost scales with slate size × markets × regions. Prefer explicit `bookmakers=` over broad regions when it reduces billed region groups.

## Errors

| Condition | Behavior |
| --- | --- |
| Missing/invalid `THE_ODDS_API_KEY` | Soft-fail Odds indexes; Underdog path still works; PrizePicks may be empty |
| Odds API HTTP/timeout | Soft-fail like Parlay today; set `error` string on payload when useful |
| Empty PrizePicks DFS from Odds | Empty board + existing empty copy |
| Scraper snapshot miss (PX/Pin/UD) | Unchanged soft behavior |

## Testing

- Provider: fixture → indexed quotes + PrizePicks board seed rows
- `prop_fair`: Tier 1 equal avg of PX/Novig/Kalshi; Soft Consensus BetMGM/BetOnline/Pinnacle; removed books ignored
- `props` assemble: no Parlay client calls; `betonline` present; removed books absent from schema serialization
- Frontend: expand book set; OpenAPI regen
- Update `md/system-design.md` `/mlb/prop_picks` row

## Out of scope

- `eu` region
- Odds API copies of ProphetX / Pinnacle / Underdog (scrapers remain source of truth)
- Persisting Odds API responses into Supabase
- Decommissioning the PrizePicks scraper job (unused for serve only)
- WNBA prop picks / Parlay path elsewhere

## Success criteria

1. PrizePicks tab shows lines from Odds API without `odds.mlb_prizepicks`.
2. No Parlay request on `GET /api/mlb/props/today`.
3. Fair Tier 1 uses equal average of PX + Novig + Kalshi when present.
4. Expand shows only the retained book set (+ BetOnline).
5. Underdog / ProphetX / Pinnacle scrapers still feed the board as today.
