# MLB Preview odds: all books + Bookmaker column

Date: 2026-08-10  
Status: Approved for planning  
Supersedes (UI columns only): moneyline column in `2026-08-05-mlb-preview-game-odds-board-design.md`

## Goal

On `/mlb/games/:gamePk` **Preview**, the right-rail **Odds** board should:

1. **Drop Money** (moneyline) from the grid.
2. Show a **Bookmaker** column (book display name only).
3. **Showcase every available team book** for the matchup (not a single preferred book).
4. Include **ProphetX** and **Novig** full-game team lines when present, alongside Pinnacle and Sharp (FD/DK) fallbacks.

Matchups page behavior stays preference-merge (one book per game) unless explicitly changed later.

## Decisions

| Topic | Choice |
| --- | --- |
| Layout | Approach 1: **one block per book**, stacked; each block = Away + Home rows |
| Columns | **Bookmaker · Total · Spread** (no Money) |
| Bookmaker cell | Display name only (`ProphetX`, `Novig`, `Pinnacle`, `FanDuel`, `DraftKings`) |
| Total / Spread | Unchanged tile shape: line on top, American price under |
| Total sides | Away = Over; home = Under |
| Books shown | Every source that has FG team markets for this away@home (+ game date) |
| Book order | ProphetX → Novig → Pinnacle → FanDuel → DraftKings |
| Period filter | Full game only (same as today: Pinnacle `period=0` / non-alt; PX/Novig market_type ∈ moneyline/run_line/spread/total/total_runs) |
| Moneyline data | Still may exist on API `board` for other consumers; Preview UI does not render it |
| Matchups API consumers | Keep existing `merge_odds_by_priority` for flat `games[]` used by matchups **or** add a parallel list — see API |
| Out of scope | Live/final centers, Open lines, Refresh control, period markets, WNBA board |

## Architecture

```
odds.mlb_prophetx_team
odds.mlb_novig_team      ← wire fetch + normalize
odds.mlb_pinnacle_team
Sharp FD/DK (run_line, total_runs)
        ↓
GET /api/mlb/odds/today
  games[]          — still one preferred game per matchup (matchups)
  book_boards[]    — NEW: all books for preview (or equivalent shape)
        ↓
Preview: match by away@home + gameDate
  → MlbGameOddsBoard stacks one section per book
```

## API

### Preferred shape (additive)

Extend `MlbOddsResponse` with:

```text
book_boards: list[MlbOddsBookBoard]
```

`MlbOddsBookBoard`:

- `sportsbook: str` — slug (`prophetx`, `novig`, `pinnacle`, `fanduel`, `draftkings`)
- `away_abbrev`, `home_abbrev`, `game_date: str | null`
- `board: MlbOddsBoard` — existing away/home sides (spread + total required for display; moneyline ignored by UI)

Keep `games[]` as today’s priority-merged list so `/mlb/matchups` and existing `findMlbOddsGame` callers do not break.

### Backend work

1. Add `fetch_latest_novig_team(league)` in `odds_snapshots.py` (mirror ProphetX team: latest `scraped_at`, FG market types).
2. Normalize Novig team rows via existing `normalize_team_odds_rows(..., sportsbook="novig")`.
3. In `get_today_odds`:
   - Build per-source game lists: PX, Novig, Pinnacle, Sharp (FD then DK as today).
   - `games = merge_odds_by_priority(pin, px, novig, sharp)` — preserve matchups priority (document order: Pinnacle first remains for matchups).
   - `book_boards = flatten all sources that `_has_markets`, keyed by (sportsbook, away, home, game_date)`, sorted by book order then matchup.
4. Update `_response_sportsbook` only for the merged `games` header (unchanged intent).

### Frontend work

1. Types / OpenAPI: consume `book_boards` (or interim: if absent, fall back to single `games` board).
2. `mlbOddsBoard.ts`: helper `toMlbOddsBookBoardsView(response, away, home, gameDate) → list of { sportsbook, rows }` with Total + Spread tiles only (Bookmaker is the sportsbook label, not a tile kind).
3. `MlbGameOddsBoard`:
   - Headers: Bookmaker | Total | Spread.
   - For each book view: two team rows; first column shows book name (both rows).
   - Section header: “Odds” + as-of (omit single sportsbook subtitle, or show “N books”).
   - Skip books with neither total nor spread.
4. Wire from `MlbPregameCenter` / `MlbProjectedLineups` using the multi-book helper.
5. Tests: board labels; multi-book render; Novig fetch SQL; merge still one game for matchups.

## Error handling

- No books for matchup → “Odds unavailable”.
- Soft Sharp errors: still show PX/Novig/Pinnacle boards when present.
- Missing price → show line with `–` under (same as today).

## Testing

- Backend: Novig team latest-snapshot query; `book_boards` includes PX + Novig when fixtures present; `games` still length-1 per matchup.
- Frontend: no “Money” text; “Bookmaker” present; two books → two Away/Home pairs; book names rendered.

## Non-goals

- Changing matchups card to multi-book.
- Showing moneyline elsewhere on Preview.
- Balancing / staking display from exchange books.
