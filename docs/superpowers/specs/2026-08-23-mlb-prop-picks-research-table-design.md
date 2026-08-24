# MLB prop picks — sportsbook research table

Date: 2026-08-23  
Status: Approved (design)  
Supersedes on `/mlb/prop_picks` only: `docs/superpowers/specs/2026-08-19-mlb-prop-picks-player-board-design.md`  
Parent: `docs/superpowers/specs/2026-08-05-mlb-prop-picks-design.md`  
Does **not** change `GET /api/mlb/props/today` or game-detail Props.

## Goal

Replace the MLB DFS **player board** on `/mlb/prop_picks` with a dense, sortable **research table** (one row per player + market + exact line + side). Line is a posted number that books share; Odds chips are books quoting that number; IP is de-vigged from the sharpest two-way at that line for the row’s side; matchup ranks and L5/L10/L15 sit on the row.

PrizePicks and Underdog are **not** page tabs. They appear only as Odds chips, and they may create an extra row when their main number differs from sportsbook mains.

## Decisions

| Topic | Choice |
| --- | --- |
| Page | `/mlb/prop_picks` is the table only; no `?app=` |
| Player route | Remove `/mlb/prop_picks/player/:playerSlug` |
| DFS today API | Unchanged; still feeds game-detail Props |
| Board API | New `GET /api/mlb/props/board` |
| Row grain | `player + canonical stat + exact line + side` |
| Line seed | Each sportsbook **main** + PrizePicks/Underdog **mains**; no alt ladders |
| Odds chips | Books whose main (or DFS main) equals this exact line; show this side’s American when posted |
| IP | Multiplicative de-vig of sharpest two-way at this line (ProphetX → Novig → Pinnacle → DraftKings); **row side**; DFS never sets IP |
| Opp Def Rank | Batter props: opponent staff ERA rank (1 = lowest ERA = toughest). Pitcher props: opponent offense OPS rank (1 = highest OPS = toughest) |
| Opp Pace Rank | Opponent plate appearances per game rank (1 = highest pace), same on batter and pitcher rows |
| L5 / L10 / L15 | Hit rate of this side vs this exact line over last N **played** games (not team games / DNPs) |
| First cell | Composite: headshot, name, matchup, market (`Over 1.5 Hits`) |
| Filters | Team + Proposition (market) + Over/Under + Hit rate (L5/L10/L15 highest→lowest) + player name search |
| Default sort | Game start, player name, market, Over before Under, line |
| Empty IP/ranks/L# | Render `—`; sort last |

## Architecture

```
/mlb/prop_picks
        │
        ▼
MlbPropPicksPage
        │
        ▼
GET /api/mlb/props/board
        │
        ├─ sportsbook mains (ProphetX, Novig, Pinnacle snapshots + Parlay `mlb_parlay_api_odds`)
        ├─ DFS mains (PrizePicks + Underdog snapshots) — extra lines + chips only
        ├─ cluster keys: (match_player_key, stat, line)
        ├─ emit Over row + Under row per cluster (always both sides)
        ├─ IP from first two-way in ProphetX → Novig → Pinnacle → DraftKings
        ├─ opponent from today’s MLB schedule
        ├─ league team ranks (ERA, OPS, PA/G)
        └─ MLB Stats API game logs → L5 / L10 / L15
```

`GET /api/mlb/props/today` stays the DFS +EV assembler. Do not reuse its `app` / `format` / `legs` / `fair_pct` / `edge_pct` as the table contract.

## Product surface

### Keep

- MLB subnav item Prop Picks → `/mlb/prop_picks`
- Team + name filters (repointed at board rows)
- Headshots / team abbrev from the existing ESPN MLB player index when matched
- Book deep-links where the app already has a URL (optional chip click); row click does **not** open a player page

### Remove from this page

- PrizePicks / Underdog tabs and `app` query
- Player cards, “View X props”, `groupMlbPropPlayers` as the board UI
- Route `/mlb/prop_picks/player/:playerSlug` (`MlbPlayerPropsPage`). Old URLs **replace-redirect** to `/mlb/prop_picks`.

### Unchanged elsewhere

- Game detail Props tabs (PrizePicks / Underdog) and `GET /api/mlb/props/game/{game_pk}`
- WNBA `/wnba/prop_picks` player board

## Row clustering

1. Collect candidate quotes:
   - Sportsbook **main** O/U for `(player, stat)` from the same sources as today’s `books_main`: ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle.
   - PrizePicks and Underdog **main** for `(player, stat)` from the latest MLB DFS snapshots.
2. Drop alts (`*_alternate`, non-main ladder rungs).
3. Unmatched player names (existing `match_player_key` / aliases) are skipped, not guessed.
4. Bucket by `(player_key, stat, line)` where `line` is the posted number (exact float match after the same rounding used on `books_main`, typically one decimal).
5. Every bucket emits **both** an Over row and an Under row. Sportsbook mains are two-way; DFS is a pick on either side of the same number.
6. Split mains (DK 1.5, ProphetX 2.0) → two buckets → four rows.

A row exists only if at least one **allowed** source (sportsbook main or DFS main) sits on that number.

## Columns

| UI | Payload | Rules |
| --- | --- | --- |
| Composite (not a header “Player”) | `player_name`, `headshot_url`, `team_abbrev`, `opponent_abbrev`, `home_away`, `market_label`, `side` | Name bold; matchup muted (`NYY @ BOS` from the player’s game); market line `Over 1.5 Hits` using `display_stat_label` |
| Line | `line` | The clustered number |
| Odds | `books[]` | Icon + American for this side when the book posts a two-way; DFS chips may omit American and show icon only. Overflow `+N`. Order: ProphetX, Novig, Pinnacle, DraftKings, FanDuel, BetMGM, Caesars, bet365, Kalshi, Fliff, PrizePicks, Underdog (skip missing). |
| IP | `ip_pct` | Integer percent, e.g. `53`. Null → `—` |
| Opp Def Rank | `opp_def_rank`, `opp_def_label` | Pill: `12th BOS`. Null → `—` |
| Opp Pace Rank | `opp_pace_rank`, `opp_pace_label` | Same pill treatment |
| L5 / L10 / L15 | `hit_l5`, `hit_l10`, `hit_l15` | Percent 0–100 or null; colored cells |

## IP (de-vigged)

Among books on **this exact line** that have **both** Over and Under American prices, pick the first in:

1. ProphetX
2. Novig
3. Pinnacle
4. DraftKings

Convert each American to raw implied probability, then **multiplicative** de-vig:

```
p_over = implied(over_american)
p_under = implied(under_american)
ip_over = p_over / (p_over + p_under)
ip_under = p_under / (p_over + p_under)
```

Display `ip_over` on Over rows and `ip_under` on Under rows, rounded to the nearest integer percent.

PrizePicks, Underdog, FanDuel, BetMGM, Caesars, Kalshi, Fliff, and bet365 **never** set IP. If none of the four IP books have a two-way at this line, `ip_pct` is null (typical DFS-only extra line).

## Opponent ranks

Opponent = the other club in the player’s scheduled game today. No game or unmatched team → both ranks null.

League ranks use MLB Stats API team season hitting/pitching (extend `team_season` helpers as needed). Competition ranks with gaps after ties, same as preview Team Stats.

**Opp Def Rank (1 = toughest, warm pill; easier = cool pill)**

Batter canonical stats: `hits`, `hits_runs_rbis`, `home_runs`, `rbis`, `runs`, `singles`, `doubles`, `triples`, `stolen_bases`, `total_bases`, `walks`, `batter_strikeouts`, `plate_appearances`

- Rank opponent **pitching ERA**, lower ERA = rank 1.

Pitcher canonical stats: `pitcher_strikeouts`, `hits_allowed`, `walks_allowed`, `earned_runs_allowed`, `runs_allowed`, `pitching_outs`, `pitches_thrown`

- Rank opponent **offense OPS** (`obp + slg` if OPS is not on the split). Higher OPS = rank 1.

**Opp Pace Rank (1 = highest pace)**

- Rank opponent **plate appearances / games played** from the hitting split. Higher PA/G = rank 1. Same value on batter and pitcher rows.

Pills show ordinal + opponent abbrev (`12th BOS`). Missing stats → null.

## L5 / L10 / L15

New read: MLB Stats API player game logs for slate players, cached per player (TTL on the order of the existing team-season cache, ~15 minutes). Failure to fetch logs must not fail the board; those cells are null and a warning is set.

**Sample**

- Batter markets: last N games with `plateAppearances > 0`.
- Pitcher markets: last N games with a pitching appearance (`inningsPitched > 0` or `battersFaced > 0` or `outs > 0`). Sit / DNP games are skipped, not zeros.

**Hit**

- Over: `actual > line`
- Under: `actual < line`
- Push (`actual == line`): miss for that side; still in the denominator.

Map canonical `stat` onto the log field (hits → `hits`, total bases → `totalBases`, pitcher Ks → `strikeOuts` in the pitching log, etc.). Combo markets (`hits_runs_rbis`) sum the component fields. If a field is missing, that window is null rather than 0%.

Need at least 1 qualifying game to show a percent; otherwise null. Windows of 5/10/15 use `min(N, available)` (4 of 4 at L5 is 100% if only four games exist).

**UI:** percent cells use a green → amber → red scale (high hit rate green). No H2H or season columns in v1.

## Filters, sort, chrome

- Team multi-select filters `team_abbrev`.
- Search matches player name (case-insensitive substring).
- Proposition multi-select filters `stat` (market), labeled from the market name (Hits, Strikeouts, …).
- Over/Under multi-select filters `side`.
- Hit rate is a single-select of L5 / L10 / L15 that sorts that column **highest → lowest**.
- Default sort: `game_start_at`, `player_name`, `stat`, Over before Under, `line`.
- Every column header is sortable. Null IP / ranks / hit rates sort last in both directions.
- Keep a last-updated time from `as_of` or React Query `dataUpdatedAt`.
- Dense dark table, sticky header, horizontal scroll on small screens. No card grid.
- Client paginates **30 rows per page** after sort, with Previous/Next (same chrome as the old player list).

## Backend shape

`GET /api/mlb/props/board` → 200 even when some enrichments fail.

```text
as_of: datetime
warnings: list[str]   # e.g. parlay_unavailable, gamelogs_unavailable, team_ranks_unavailable
rows: list[MlbPropBoardRow]
```

Each row includes identity, `stat`, `side`, `line`, `market_label`, `game_pk`, `game_start_at`, `books` (sparse list of `{book, american, url?}`), `ip_pct`, opponent rank fields, `hit_l5` / `hit_l10` / `hit_l15`.

Assembler lives in a new module (e.g. `app.domains.mlb.prop_board`) so DFS fair/edge code does not leak into the table. Reuse snapshot fetchers, `books_main` indexing, and player match keys.

## Frontend

- `MlbPropPicksPage` loads `useMlbPropBoard()` → `/api/mlb/props/board`.
- New table components under `frontend/src/features/mlb/league/` (e.g. `MlbPropPicksTable.tsx`).
- Stop routing `MlbPlayerPropsPage`; drop player-board grouping from this page. Keep `MlbPropPicksFilters` if it still applies to rows.
- Router: player path replace-redirects to `/mlb/prop_picks`; update `AppRouter` tests.
- OpenAPI export + frontend schema regen when the new path is added.
- Update `md/system-design.md` page ↔ API table for `/mlb/prop_picks`.

## Errors

| Situation | Behavior |
| --- | --- |
| No mains and no DFS for today | `rows: []`, page empty copy “No board yet” |
| Parlay snapshot empty | Sportsbook chips that come only from Parlay omitted; ProphetX/Novig/Pinnacle/DFS still cluster; `parlay_unavailable` |
| Game logs fail | Rows still render; L# = `—`; `gamelogs_unavailable` |
| Team season ranks fail | Rank cells `—`; `team_ranks_unavailable` |
| Player unmatched | Quote dropped |
| DFS-only line | Row exists; IP `—` unless a sharp two-way also sits on that number |

Do not 500 because an enrichment source failed.

## Tests

**Backend**

- Two mains at different lines → separate clusters (Loyd 10 vs 9.5 analogue).
- Several books on the same line → one cluster, multiple Odds chips.
- DFS-only line → row with null IP.
- IP uses ProphetX over DraftKings when both two-way at the line; Over vs Under percents sum to 100 after de-vig.
- Batter row uses ERA rank; pitcher row uses OPS rank; both use PA/G pace.
- L5 skips games with 0 PA; push is not a hit.
- Empty slate → empty `rows`, 200.

**Frontend**

- Table headers: composite, Line, Odds, IP, Opp Def Rank, Opp Pace Rank, L5, L10, L15.
- No PrizePicks/Underdog tabs.
- Null IP renders `—`.
- Team + search filter rows.
- `/mlb/prop_picks/player/:slug` is not a player odds-grid page.

## Out of scope

- WNBA research table
- Changing game-detail Props or `GET /api/mlb/props/today`
- Alt ladders, H2H, season hit-rate columns
- Slate builder / betslip
- Using FanDuel or DFS juice for IP
- NBA
