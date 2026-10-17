# NBA prop board

Date: 2026-10-16  
Status: Approved (design)  
Applies to: `/nba/prop_picks` and `GET /api/nba/props/board`  
Copies the WNBA research table. Does not change the MLB or WNBA boards, game-detail Props, or `GET /api/*/props/today`.

## Goal

NBA Props is the same research table as MLB and WNBA. It opens on PrizePicks. Each row is that book’s line for a player, prop type, and side. **Odds** lists other books only when they posted the same player, the same prop type, and the same line. **IP** is the consensus implied probability of the anchor price plus those matches. A line only the anchor posted uses that line’s own implied probability. L5, L10, L15, and H2H are scored against that anchor line from stats.nba.com game logs.

Lines come from the latest Supabase snapshots in new `odds.nba_*` tables. The board and the Bookmaker control show only books that have an NBA Supabase table and a scraper that writes it. That set includes FanDuel and DraftKings.

## Decisions

| Topic | Choice |
| --- | --- |
| Shape | Copy of the WNBA board in NBA modules. No shared MLB/WNBA/NBA board package. |
| Anchor | Query `book`, default `prizepicks`. One book at a time. |
| Valid books | Supabase books only: `prophetx`, `novig`, `pinnacle`, `draftkings`, `fanduel`, `prizepicks`, `underdog`. |
| Excluded books | `betmgm`, `caesars`, `bet365`, `kalshi`, `fliff`. No NBA Parlay snapshot and no scraper for those. |
| Unknown `book` | **422**. The page shows its existing error state. |
| Row grain | `player + prop type + anchor line + side`. Emit a side only when the anchor has a price for it. |
| Line seed | Each book’s **main** only. Alt ladders stay out. |
| Match rule | Same cluster: same `player_key`, same stat, same `round_line` (one decimal), with a price for this side. |
| Odds | Other matching books only. The anchor is not repeated. Empty when nobody else matches. |
| Line cell | Anchor line and that side’s American. No logo. |
| PrizePicks price | Missing American is **-137** on the chip and inside **IP**. |
| IP | Average raw implied probability of the anchor American and every matching book’s American for this side. No de-vig. |
| Bookmaker control | Single select of the seven-book list above. Stored in `?book=`. |
| Default URL | Absent `book` means PrizePicks. Choosing PrizePicks removes the param. Choosing another book sets `?book=`. Clearing the control removes the param. |
| Fetch | The client always sends the resolved book. The query key includes it. Sidebar prefetch uses `prizepicks`. |
| Filters | Game, proposition, over/under, hit rate, player search. Applied in the browser. No Team filter. No DFS column. |
| Columns | **Proposition, Line, Odds, IP, L5, L10, L15, H2H**. |
| Stale time | 15 minutes, no refetch on window focus. |
| Hit rates | Live stats.nba.com `playergamelog` for the current season. The batch `raw` game-log pipeline is not the source. |
| DraftKings / FanDuel | From `odds.nba_draftkings` and `odds.nba_fanduel`, filled by the NBA DraftKings and FanDuel scrapers. Not from a Parlay table. |

## Snapshots

One migration file per table, `046` through `055`. Each table matches the named mirror: columns, primary key, and indexes, including `is_main` where that mirror has it. `league` stores `nba`.

Player-prop tables the board reads:

| NBA table | Mirrors | Written by |
| --- | --- | --- |
| `odds.nba_prizepicks` | `odds.mlb_prizepicks` | `nba_prizepick` |
| `odds.nba_underdogs` | `odds.mlb_underdogs` | `nba_underdog` |
| `odds.nba_prophetx` | `odds.mlb_prophetx` (with `is_main`) | `nba_prophetx` |
| `odds.nba_novig` | `odds.mlb_novig` | `nba_novig` |
| `odds.nba_pinnacle` | `odds.mlb_pinnacle` | `nba_pinnacle` |
| `odds.nba_draftkings` | `odds.wnba_draftkings` | `nba_draftking` |
| `odds.nba_fanduel` | `odds.wnba_fanduel` | `nba_fanduel` |

Team tables. The board does not read them. They exist so an NBA team scrape has a home:

| NBA table | Mirrors |
| --- | --- |
| `odds.nba_prophetx_team` | `odds.mlb_prophetx_team` |
| `odds.nba_novig_team` | `odds.mlb_novig_team` |
| `odds.nba_pinnacle_team` | `odds.mlb_pinnacle_team` |

No `odds.nba_parlay_api_odds`. The board does not read BetMGM, Caesars, bet365, Kalshi, or Fliff.

`src/odds/quote_specs.py` registers each new table with the same `QuoteSpec` as its mirror (`_BOOK_PROPS` for FanDuel and DraftKings).

`league="nba"` selects the `nba_*` table in:

- `_prizepicks_table`, `_underdog_table`
- `_pinnacle_props_table`, `_pinnacle_team_table`
- `_prophetx_props_table`, `_prophetx_team_table`
- `_novig_props_table`, `_novig_team_table`
- a new DraftKings / FanDuel table helper used by the loaders below

Today PrizePicks, Underdog, and Pinnacle fall through to the WNBA tables, and ProphetX and Novig fall through to the MLB tables. NFL routing stays as it is.

Define `load_draftkings_snapshot` and `load_fanduel_snapshot` in `src/odds/load_snapshots.py`. The NBA (and WNBA) scrapers already call them. Each loader maps scraper pick dicts (`full_name`, `stat_name`, `stat_value`, `choice`, `american_price`) into book rows and upserts `odds.{league}_draftkings` or `odds.{league}_fanduel`. For `league="nba"` that is the new NBA table. For `league="wnba"` that is the existing WNBA table. Creating `odds.mlb_draftkings` / `odds.mlb_fanduel` is out of scope; MLB scrapes that call these loaders may still fail until those tables exist.

`fetch_latest_prizepicks`, `fetch_latest_underdog`, `fetch_latest_pinnacle`, `fetch_latest_prophetx`, `fetch_latest_novig`, `fetch_latest_draftkings`, and `fetch_latest_fanduel` read the NBA table when the league is `nba`. The board query is `DISTINCT ON` the quote identity, `scraped_at DESC`. It does not call a book live. The board does not call `fetch_latest_parlay_api_odds`.

## Architecture

```
/nba/prop_picks?book=prizepicks|draftkings|…
        │
        ▼
useNbaPropBoard(book)
  query key ["nba", "props", "board", book]
        │
        ▼
GET /api/nba/props/board?book=<id>
        │
        ├─ latest mains from odds.nba_* (seven books)
        ├─ cluster (player_key, stat, line)
        ├─ keep clusters that contain `book`
        ├─ attach today’s game from the NBA scoreboard
        ├─ headshot from the ESPN NBA roster
        ├─ hit rates from stats.nba.com for those clusters only
        ├─ Over and Under when the anchor has that side’s price
        ├─ row.anchor = selected book at this line and side
        ├─ row.books  = other books in this same cluster with that side’s price
        └─ row.ip_pct = consensus of anchor + those books
        │
        ▼
Browser filters: game, proposition, side, hit rate, name
```

New backend modules, copied from the WNBA board and renamed:

- `backend/app/domains/nba/prop_board.py`
- `backend/app/domains/nba/prop_board_cluster.py`
- `backend/app/domains/nba/prop_board_form.py`
- `backend/app/domains/nba/prop_board_logs.py`
- `backend/app/domains/nba/schemas_prop_board.py`

The route is added to `backend/app/domains/nba/routes.py`. Stat keys come from `app.domains.betting.prop_stat_keys`. Player joins use `match_player_key`.

`BOOK_CHIP_ORDER` for the NBA board is ProphetX, Novig, Pinnacle, DraftKings, FanDuel, PrizePicks, Underdog. There is no Parlay book list and no `parlay_unavailable` warning.

`prop_board_logs.py` fetches stats.nba.com with the same three calls the WNBA board uses on stats.wnba.com: `commonallplayers`, then `leaguedashplayerstats` when that list is empty, then `playergamelog` per matched player. `current_nba_season()` returns `YYYY-YY`. In October through December the start year is the current calendar year. In January through September it is the previous calendar year. On 2026-10-16 the season is `2026-27`. Logs are cached for 15 minutes.

Game, team, opponent, home/away, and tip time come from `nba.scoreboard.get_today_scoreboard`. The headshot comes from the existing ESPN NBA roster. Opponent defense rank and pace rank stay null and are not shown.

## API

`GET /api/nba/props/board`

| Query | Behavior |
| --- | --- |
| omitted `book` | Treated as `prizepicks`. |
| known book id (one of the seven) | 200. `rows: []` when that book posted nothing. |
| any other value | 422, `detail` `unknown book: …`, `Cache-Control: no-store`. |

Every response sets `Cache-Control: no-store`.

`NbaPropBoardRow` matches `WnbaPropBoardRow`:

| Field | Contents |
| --- | --- |
| `line` | The anchor line. |
| `game_id` | ESPN event id from today’s scoreboard, or null. |
| `anchor` | One chip for the selected book: `book`, `american`, `url`, `line`, both side Americans. `devig_pct` stays null. |
| `books` | Other matching books from the seven, chip order, one chip each. |
| `ip_pct` | Integer average raw implied percent. Set on every returned row. |
| `hit_l5`, `hit_l10`, `hit_l15`, `hit_h2h` | Integer percent, or null. |
| `opp_def_rank`, `opp_def_label`, `opp_pace_rank`, `opp_pace_label` | Always null. |

PrizePicks with a null side American is stored as `-137` before IP is computed, whether PrizePicks is the anchor or a match. Any other book with a null side American is omitted from that side and does not produce a row when it is the anchor and that side is missing.

Chip order for `books` is ProphetX, Novig, Pinnacle, DraftKings, FanDuel, PrizePicks, Underdog, skipping the anchor and any book not in the cluster.

OpenAPI export and `npm run generate:api` include the new route.

## Hit rates

Scored stats: `points` (`PTS`), `rebounds` (`REB`), `assists` (`AST`), `threes` (`FG3M`), `pts_rebs`, `pts_asts`, `rebs_asts`, `pts_rebs_asts`. Any other stat leaves the four hit-rate fields null and keeps the row.

A qualifying game has `MIN` greater than 0. L5, L10, and L15 use the newest qualifying games. Over hits when the actual is greater than the line. Under hits when the actual is less than the line. An equal value is a miss. The percent is the integer rounded share of games in that window. A window with a missing stat value is null. H2H uses the same score for qualifying games whose matchup opponent is today’s opponent. No opponent, or no such games, leaves H2H null.

A player who cannot be matched keeps the row and leaves all four hit rates null. A failed scoreboard or roster lookup still returns the lines, with game fields or the headshot null. A failed stats.nba.com game-log fetch adds `gamelogs_unavailable` and still returns the lines.

## Page

`frontend/src/pages/NbaPropPicksPage.tsx` and NBA copies of the WNBA board hook, filters, header, table, and sort/filter helpers under `frontend/src/features/nba/`. Book display names reuse the existing label map.

- Route `/nba/prop_picks`.
- `/nba/prop_picks/player/:playerSlug` redirects to `/nba/prop_picks`.
- `sectionHref("nba", "Props")` returns `/nba/prop_picks`. The NBA pill on the props switcher is a link. Sidebar Props on an NBA page goes to `/nba/prop_picks`.
- Hover and sidebar prefetch call `GET /api/nba/props/board?book=prizepicks`.
- Empty successful load still shows Bookmaker. Empty copy stays “No board yet”.
- 30 rows per page. Default sort matches the WNBA board.
- Bookmaker options are the seven Supabase books only.

`md/system-design.md` gains the page row, the route row, and the data-flow note. The nav note that NBA Props falls back to MLB is updated.

## Errors

| Case | Result |
| --- | --- |
| Unknown `book` | 422, `Cache-Control: no-store`. |
| Known book, no lines | 200, `rows: []`. Bookmaker stays on that book. |
| Missing snapshot for one book | That book is absent from rows and Odds. No page error. |
| Scoreboard or roster failure | 200. The row still returns. Game fields or the headshot are null. |
| stats.nba.com game-log failure | 200, warning `gamelogs_unavailable`. Hit rates are null where the log is missing. |
| Unmatched player or unscored stat | Row stays. Hit rates are null. |

## Tests

**Snapshots**

- `league="nba"` upserts `nba_prizepicks`, `nba_underdogs`, `nba_pinnacle`, `nba_pinnacle_team`, `nba_prophetx`, `nba_prophetx_team`, `nba_novig`, `nba_novig_team`, `nba_draftkings`, and `nba_fanduel`.
- The same calls do not upsert the WNBA or MLB table.
- `load_draftkings_snapshot` / `load_fanduel_snapshot` with `league="nba"` upsert the NBA tables. With `league="wnba"` they upsert the existing WNBA tables.
- `fetch_latest_*("nba")` selects `FROM odds.nba_*`, including DraftKings and FanDuel.

**Board**

- Omitted `book` and `book=prizepicks` return the same rows. A row exists only when PrizePicks posted that player, stat, and line.
- PrizePicks 1.5 with DraftKings main 2.5: the PrizePicks row’s `books` omit DraftKings. `book=draftkings` returns the 2.5 row and omits PrizePicks.
- PrizePicks 1.5 and DraftKings 1.5 for the same player and stat: DraftKings is on `books`.
- `book=betmgm` (and the other excluded ids) returns 422.
- Two prices: `ip_pct` equals the average raw implied of the anchor and the matches. One price: `ip_pct` equals that American’s implied probability.
- PrizePicks with a null American is `-137` on `anchor.american`, and that `-137` is inside `ip_pct`.
- `book=not-a-book` returns 422.
- A known book with no quotes returns 200 and `rows: []`.
- Hit rates use a fixture game log. L5/L10/L15/H2H follow the over/under rules above. No live stats.nba.com call.

**Frontend**

- First load requests `book=prizepicks` and the control shows PrizePicks.
- Bookmaker options are the seven Supabase books. BetMGM and the other excluded books are not listed.
- Choosing DraftKings sets `?book=draftkings` and requests that book. Choosing PrizePicks again clears the param.
- Headers are Proposition, Line, Odds, IP, L5, L10, L15, H2H. There is no DFS header and no Team filter.
- The NBA props pill and the sidebar Props link on an NBA page go to `/nba/prop_picks`.

## Out of scope

- MLB and WNBA board behavior
- `GET /api/mlb/props/today`, `GET /api/wnba/props/today`, and game-detail Props
- `odds.nba_parlay_api_odds` and a live NBA Parlay client
- `odds.mlb_draftkings` / `odds.mlb_fanduel` migrations
- Alt lines
- A shared board module
- Opponent defense and pace ranks
- The batch `src/pipeline` game-log tables as a hit-rate source
