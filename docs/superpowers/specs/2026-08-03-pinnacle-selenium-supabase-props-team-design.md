# Selenium Pinnacle → Supabase props + team lines (Prop Picks & matchups)

Date: 2026-08-03  
Status: Approved for planning

## Goal

Own **Pinnacle** with the Selenium scraper end-to-end:

1. Upsert player props into existing `odds.wnba_pinnacle`.
2. Upsert team markets into a **new** `odds.wnba_pinnacle_team` table.
3. Split on-disk scrape output into separate **props** and **team** JSON files.
4. Prop Picks: keep the current board (Parlay US books + Supabase PP/UD); replace only the **Pinnacle column** with the latest Selenium snapshot from Supabase.
5. Matchup cards: prefer Pinnacle main spread/total from Supabase; **Sharp per game** when Pinnacle has no line.

Parlay API must **never** request or persist Pinnacle, so it cannot overwrite scraper rows.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Reuse `odds.wnba_pinnacle` + new `odds.wnba_pinnacle_team` |
| Prop Picks Pinnacle source | Latest Selenium snapshot in `odds.wnba_pinnacle` only |
| Other Prop Picks books | Unchanged (Parlay US books + Supabase PP/UD) |
| Parlay + Pinnacle | Remove `pinnacle` from Parlay allowlists and persist lists |
| Missing Pinnacle props | `pinnacle: null` on rows (no Parlay fallback) |
| Team storage | Dedicated table + separate `*_team.json` file |
| Matchup odds primary | Latest `odds.wnba_pinnacle_team` (period=0, `is_alternate=false`) |
| Matchup odds fallback | Sharp for that game only when Pinnacle has no spread and no total |
| Disk fallback for team | None (Supabase → Sharp only) |
| Matchup card markets | Spread + total only (no moneyline on cards in v1) |
| League UI path | WNBA Prop Picks + WNBA matchups (schema keeps `league` for NBA later) |
| Scraper scheduling | Out of scope — operator still runs `pinnacle.py` |

## Architecture

```
pinnacle.py (Selenium)
  → data/props/pinnacle/{league}/pinnacle_{league}_{ts}_props.json
  → data/props/pinnacle/{league}/pinnacle_{league}_{ts}_team.json
  → upsert odds.wnba_pinnacle
  → upsert odds.wnba_pinnacle_team

GET /api/wnba/props/today  (parlay_props)
  ├─ Parlay /props          # books EXCEPT pinnacle
  ├─ Supabase PP / UD       # unchanged
  ├─ Supabase pinnacle      # latest scraped_at, league=wnba
  └─ Merge → same WnbaPropLine shape

GET /api/wnba/odds/today
  ├─ Load latest odds.wnba_pinnacle_team (main FG lines)
  ├─ Map teams → abbrevs; emit Sharp-compatible DTO
  ├─ For games with no Pinnacle spread AND no total → Sharp row
  └─ Frontend mergeMatchupOdds (unchanged matching rules)
```

## Data model

### Props — reuse `odds.wnba_pinnacle` (migration 021)

Unchanged columns:

- `league`, `player_name`, `market_type`, `stat_category`, `side`, `line_score`, `american_price`, `scraped_at`, `fetched_at`
- PK: `(league, player_name, market_type, side, line_score, scraped_at)`

Selenium mapper:

| Scraper field | Snapshot column |
| --- | --- |
| `league` | `league` (`nba` / `wnba`) |
| `player` | `player_name` |
| `stat` (e.g. `points`) | `market_type` / `stat_category` (same convention as existing Parlay→table mapper) |
| over / under | two rows: `side` + matching `american_*` |
| scrape batch time | shared `scraped_at` per run |

### Team — new `odds.wnba_pinnacle_team` (next migration, e.g. 024)

```sql
CREATE TABLE IF NOT EXISTS odds.wnba_pinnacle_team (
    league           TEXT        NOT NULL,  -- nba | wnba
    matchup_id       BIGINT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,  -- moneyline | spread | total
    period           INTEGER     NOT NULL DEFAULT 0,
    is_alternate     BOOLEAN     NOT NULL DEFAULT FALSE,
    side             TEXT        NOT NULL,  -- home | away | over | under
    team             TEXT,                  -- nullable for totals
    points           NUMERIC,               -- null for moneyline
    american_price   INTEGER     NOT NULL,
    decimal_price    NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moneyline has null points; NULLS NOT DISTINCT keeps one row per side.
CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_snapshot_uidx
    ON odds.wnba_pinnacle_team (
        league, away_team, home_team, market_type, period,
        is_alternate, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_league_scraped_at_idx
    ON odds.wnba_pinnacle_team (league, scraped_at DESC);
```

Notes:

- Prefer `UNIQUE … NULLS NOT DISTINCT` (Postgres 15+ / current Supabase) over stuffing a sentinel into `points` for moneyline.
- Matchup cards read `period = 0` and `is_alternate = false` only; alts may still be stored for later use.
- Moneyline rows are stored even though cards do not display them in v1.

### On-disk split

Per successful scrape (both leagues if requested):

- `…/pinnacle_{league}_{YYYY-MM-DD}_{HHMMSS}_props.json` — games with `props[]` (and game meta)
- `…/pinnacle_{league}_{YYYY-MM-DD}_{HHMMSS}_team.json` — games with `team_markets` (and game meta)

Stop writing the combined single-file format for new runs. Loaders may still accept the legacy combined file for one-off backfills if useful; not required for the API path.

## Parlay: remove Pinnacle

Strip `pinnacle` from every path that would fetch or write it:

- `PROP_SPORTSBOOKS` / display list: **keep** `pinnacle` as a response column (filled from Supabase).
- Parlay **fetch** allowlist: exclude `pinnacle` so live Parlay rows never attach as Pinnacle.
- `PARLAY_PROP_SPORTSBOOKS` / `_PARLAY_BOOK_TABLES` / `maybe_persist_parlay_props`: do not persist `odds.wnba_pinnacle`.
- `select_parlay_main_lines` / sharpness order: do not treat Parlay’s pinnacle bookmaker as the sharp source for the Pinnacle column (Selenium snapshot wins).
- `parlay_odds` (if still unused by the WNBA route): exclude pinnacle from any future wiring that would compete with Selenium team lines; WNBA matchups use the new Supabase+Sharp path instead.

## API behavior

### `GET /api/wnba/props/today`

1. Fetch Parlay props; filter out `bookmaker=pinnacle`.
2. Attach PP/UD from Supabase (existing).
3. Load latest `odds.wnba_pinnacle` for `league=wnba` (same “latest scraped_at” pattern as DFS).
4. Map snapshot rows onto the `pinnacle` field of each `WnbaPropLine` (match player + market + side; prefer exact line, else closest — mirror existing sportsbook-to-DFS attach rules where applicable).
5. Board keep rule unchanged from the Aug 2 DFS spec: DFS-first (keep rows with PrizePicks and/or Underdog).

### `GET /api/wnba/odds/today`

1. Build candidate rows from latest `odds.wnba_pinnacle_team` mains → DTO compatible with current frontend (`home_abbrev`, `away_abbrev`, `spread_team_abbrev`, `spread_line`, `total`, `sportsbook="pinnacle"`, `game_date` when available).
2. Call Sharp for the slate (existing `sharp_odds` helper).
3. Per ESPN game key: use Pinnacle row if it has spread and/or total; otherwise use Sharp row for that game.
4. Frontend `mergeMatchupOdds` / pills unchanged except sportsbook caption when `sportsbook === "pinnacle"`.

## Scraper upsert path

Mirror PrizePicks/Underdog:

- After writing both JSON files, call loaders in `src/odds/` (e.g. `load_pinnacle_props_snapshot`, `load_pinnacle_team_snapshot`).
- Shared `scraped_at` for the run; env flag e.g. `PINNACLE_SKIP_DB=1` to skip upsert.
- Upsert failure: log, non-zero exit after files are written (files remain usable for debugging).

## Errors & empty states

| Case | Behavior |
| --- | --- |
| No Pinnacle props snapshot | Prop Picks `pinnacle` cells null |
| No Pinnacle team snapshot / no match for a game | Sharp for that game |
| Sharp also missing | No odds pill on that card |
| Stale snapshots | v1 uses latest `scraped_at` only (no hard TTL) |

## Testing

- Unit: Selenium prop JSON → `odds.wnba_pinnacle` rows (over/under pairs).
- Unit: Selenium `team_markets` → `odds.wnba_pinnacle_team` rows (main vs alternate).
- Unit: Parlay allowlist/persist excludes `pinnacle`.
- Unit: props attach prefers Supabase Pinnacle over any stray Parlay pinnacle row.
- Unit: matchup merge — Pinnacle hit; Pinnacle miss → Sharp; both miss → null.
- Service tests with fixtures only (no live Selenium/Parlay/Sharp in CI).

## Out of scope (v1)

- NBA Prop Picks / NBA matchup odds UI wiring
- Moneyline on matchup cards
- Line-move charts / history UI
- Replacing Parlay for FanDuel, DraftKings, or other US books
- Scheduling/orchestrating `pinnacle.py`
- Disk fallback for team lines when Supabase is empty

## Implementation sketch (for planning)

1. Migration `024_odds_wnba_pinnacle_team.sql` (`UNIQUE … NULLS NOT DISTINCT` for moneyline `points`).
2. Split `pinnacle.py` output writers; row mappers + loaders; optional DB upsert.
3. Remove Pinnacle from Parlay fetch/persist paths; attach Supabase Pinnacle in `parlay_props`.
4. New or extended WNBA odds service: Supabase team + Sharp per-game fallback; wire `wnba_odds` route.
5. Frontend sportsbook caption for Pinnacle on matchup cards.
6. Tests + brief README / system-design note update.
