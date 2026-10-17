# Prop board — anchor book

Date: 2026-10-16  
Status: Approved (design)  
Amends: `docs/superpowers/specs/2026-08-28-mlb-prop-board-dfs-column-design.md`  
Applies to: `/mlb/prop_picks` and `/wnba/prop_picks`  
Does **not** change `GET /api/*/props/today` or game-detail Props.

## Goal

The board is the book the user bets. It opens on PrizePicks. Each row is that book’s line for a player, prop type, and side. **Odds** lists other books only when they posted the same player, the same prop type, and the same line. **IP** is the consensus implied probability of the anchor price plus those matches. A line only the anchor posted uses that line’s own implied probability.

The **DFS** column and the **Team** filter come off both boards.

## Decisions

| Topic | Choice |
| --- | --- |
| Leagues | MLB and WNBA research tables. Same contract. Separate modules. No new shared package. |
| Anchor | Query `book`, default `prizepicks`. One book at a time. |
| Valid books | The existing board book ids, lowercase: `prophetx`, `novig`, `pinnacle`, `draftkings`, `fanduel`, `betmgm`, `caesars`, `bet365`, `kalshi`, `fliff`, `prizepicks`, `underdog`. |
| Unknown `book` | **422**. The page shows its existing error state. |
| Row grain | `player + prop type + anchor line + side`. Emit a side only when the anchor has a price for it. |
| Sportsbook-only props | Included when that sportsbook is the anchor. Omitted when another book is the anchor. |
| Line seed | Each book’s **main** only. Alt ladders stay out. |
| Match rule | Another book is shown only from the same cluster: same `player_key`, same stat, same `round_line` (one decimal), with a price for this side. |
| Odds | Those other books only. The anchor is not repeated. Empty when nobody else matches. |
| Line cell | Anchor line and that side’s American. No logo. The Bookmaker control names the book. |
| PrizePicks price | Missing American is **-137** on the chip and inside **IP**. |
| IP | Average raw implied probability of the anchor American and every matching book’s American for this side. No de-vig. One price means that price’s implied probability. |
| Bookmaker control | Single select. Options are the fixed book list above, not books found on the current rows. The choice is the page search param `book`. |
| Default URL | Absent `book` means PrizePicks. The control still shows PrizePicks. Choosing PrizePicks removes the param. Choosing another book sets `?book=`. Clearing the control removes the param. |
| Fetch | The client always sends the resolved book. Cache key includes it. Sidebar prefetch uses `prizepicks`. |
| Filters kept | Game, proposition, over/under, hit rate, player search. Still applied in the browser to the returned rows. |
| Filters removed | Team. |
| Columns | **Proposition, Line, Odds, IP, L5, L10, L15, H2H**. No DFS column. |
| Stale time | Unchanged: 15 minutes, no refetch on window focus. |

## Architecture

```
/mlb/prop_picks?book=prizepicks|draftkings|…
/wnba/prop_picks?book=…
        │
        ▼
useMlbPropBoard(book) / useWnbaPropBoard(book)
  query key includes book
        │
        ▼
GET /api/{mlb|wnba}/props/board?book=<id>
        │
        ├─ quotes: each book’s main (unchanged sources)
        ├─ cluster (player_key, stat, line)
        ├─ keep clusters that contain `book`
        ├─ enrich only those clusters (hit rates use this line)
        ├─ Over and Under when the anchor has that side’s price
        ├─ row.anchor = selected book at this line and side
        ├─ row.books  = other books in this same cluster with that side’s price
        └─ row.ip_pct = consensus of anchor + those books
        │
        ▼
Browser filters: game, proposition, side, hit rate, name
```

`_sportsbook_mains` no longer attaches a different line onto a row. A DraftKings main of 2.5 does not appear on a PrizePicks 1.5 row. That DraftKings 2.5 cluster becomes its own rows only when `book=draftkings`.

## API

`GET /api/mlb/props/board` and `GET /api/wnba/props/board`

| Query | Behavior |
| --- | --- |
| omitted `book` | Treated as `prizepicks`. |
| known book id | 200. `rows: []` when that book posted nothing. |
| any other value | 422. |

`MlbPropBoardRow` / `WnbaPropBoardRow`:

| Field | Contents |
| --- | --- |
| `line` | The anchor line. |
| `anchor` | One chip for the selected book: `book`, `american`, `url`, `line`, both side Americans. `devig_pct` stays null. |
| `books` | Other matching books, existing chip order, one chip each. Same chip shape. |
| `ip_pct` | Integer average raw implied percent. Always set on a returned row, because a side is emitted only when the anchor has a price. |
| `dfs` | Removed from the board row. |

PrizePicks with a null side American is stored on the chip as `-137` before IP is computed, whether PrizePicks is the anchor or a match. Underdog and sportsbooks with a null side American are omitted from that side. They do not produce a row when they are the anchor and that side is missing.

Chip order for `books` stays ProphetX, Novig, Pinnacle, DraftKings, FanDuel, BetMGM, Caesars, bet365, Kalshi, Fliff, PrizePicks, Underdog, skipping the anchor and any book not in the cluster.

OpenAPI export and frontend `generate:api` pick up `book` and `anchor`, and drop board-row `dfs`.

## Page

- **Line** renders `{line}` and the anchor American (`-137` for PrizePicks).
- **Odds** renders the same chip as today (logo, that book’s line, American) for `books` only. Overflow `+N` stays. An empty list renders `—`.
- Bookmaker uses the existing single-select filter. Label shows the selected book, including the PrizePicks default.
- Team state, team options, and the team filter branch are removed. The proposition cell still shows the matchup from the row.
- Game, proposition, side, hit rate, and name filtering no longer trim chips and no longer drop rows for lack of a DFS price. The server already returned the anchor’s rows.
- Sort keys stay as they are. Odds sort uses the first matching book’s American, and an empty Odds list sorts as missing. IP sort uses `ip_pct`. Line sort uses `line`.
- MLB and WNBA each keep their own page, hook, filter, and table.

## Errors

Enrichment failures stay **200** with the current `warnings` (`parlay_unavailable`, `team_ranks_unavailable`, `gamelogs_unavailable`). A missing sportsbook snapshot leaves that book out of `books`. It is not a page error.

An anchor with no quotes returns **200** and `rows: []`. The Bookmaker control stays on that book. The table uses its existing empty state.

An unknown `book` in the page URL is sent through. The 422 uses the existing page error state.

## Tests

**Backend** (MLB and WNBA board tests)

- `book` omitted and `book=prizepicks` return the same rows. A row exists only when PrizePicks posted that player, stat, and line.
- PrizePicks 1.5 with DraftKings main 2.5: the PrizePicks row’s `books` omit DraftKings. `book=draftkings` returns the 2.5 row and omits PrizePicks.
- PrizePicks 1.5 and DraftKings 1.5 for the same player and stat: DraftKings is on `books`. Underdog on that same line is on `books` too.
- Two prices: `ip_pct` equals the average raw implied of the anchor and the matches. One price: `ip_pct` equals that American’s implied probability.
- PrizePicks with a null American is `-137` on `anchor.american` and that `-137` is inside `ip_pct`.
- `book=not-a-book` returns 422.
- A known book with no quotes returns 200 and `rows: []`.

**Frontend** (MLB and WNBA)

- First load requests `book=prizepicks` and the control shows PrizePicks.
- Choosing DraftKings sets `?book=draftkings` and requests that book. Choosing PrizePicks again clears the param.
- Headers are Proposition, Line, Odds, IP, L5, L10, L15, H2H. There is no DFS header and no Team filter.
- The Line cell shows the anchor number and American.
- Odds shows a matching book and hides a book whose line differs.

## Docs

Update `md/system-design.md` for both prop-picks pages and both `GET /props/board` rows: anchor `book`, identical-line Odds, IP rule, no DFS column, no Team filter.

## Out of scope

- `GET /api/mlb/props/today`, `GET /api/wnba/props/today`, and game-detail Props
- Alt lines
- A shared MLB/WNBA board module
- NBA props (no board)
