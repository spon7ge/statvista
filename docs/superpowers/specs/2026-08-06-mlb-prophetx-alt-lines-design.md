# MLB ProphetX player-prop alt lines (scrape → upsert → Prop Picks)

Date: 2026-08-06  
Status: Approved for planning  
Related: `2026-08-05-mlb-prophetx-scraper-design.md`, `2026-08-05-mlb-prophetx-supabase-upsert-design.md`, `2026-08-05-mlb-prop-picks-design.md`

## Goal

Include **main and alternate** ProphetX MLB **player prop** lines in snapshots and `odds.mlb_prophetx`, so `/mlb/prop_picks` can attach fair % when the selected DFS app is still on a non-favourite line (e.g. DFS 2.5 while ProphetX favourite is 3.5).

## Decisions

| Topic | Choice |
| --- | --- |
| Scope path | Full: scraper → Supabase upsert → Prop Picks attach (exact line already) |
| Markets | **Player props only**; team moneyline / run line / total stay favourite/main-only |
| Line set | Every `marketLine` with usable over/under (best top-of-book american + stake) |
| Main flag | `is_main` on each prop row / DB column |
| `is_main` source | ProphetX `favourite: true` → main; sole `marketLine` → main; else alt |
| `is_main` lifetime | **Dynamic per scrape** — always mirror current `favourite` on that run; never lock for the game |
| Multiple favourites | First favourite `is_main: true`, remaining favourites `false`; debug log |
| Prop Picks attach | Unchanged: exact `(player, stat, side, line)` |
| Prop Picks UI | No alt badge in v1; `is_main` stored for later |
| Env flag | None — alts always on for props |

## Architecture

```
mlb_prophetx.py
  → same event + market fetch as today
  → extract_props: iterate ALL marketLines → one props[] row each + is_main
  → extract_team_markets: unchanged (pick_main_market_line / favourite only)
  → write *_props.json / *_team.json
  → load_prophetx_props_snapshot (maps is_main)
  → odds.mlb_prophetx (new is_main column)
  → GET /api/mlb/props/today indexes latest PX by exact line (alts match DFS automatically)
```

### Why dynamic `is_main`

If favourite moves mid-slate (news → main 2.5 → 3.5), the next scrape must mark 3.5 as main and 2.5 as alt when still listed. Locking “first main” would drift from ProphetX and mis-label a dead main. Historical snapshots keep snapshot-time `is_main`; Prop Picks reads the **latest** scrape only. Staleness chips stay on the **exact matched line’s** quote age, not a frozen main.

## Data model

### JSON (`*_props.json`)

Each `props[]` entry gains:

```json
"is_main": true
```

Same player/stat may appear multiple times with different `line` values. Team JSON unchanged.

### Database

Migration `031_odds_mlb_prophetx_is_main.sql`:

- `ALTER TABLE odds.mlb_prophetx ADD COLUMN IF NOT EXISTS is_main BOOLEAN;`
- Nullable for rows written before this change; new upserts always set boolean.
- Unique index unchanged: `(league, event_id, player_name, stat_name, side, line_score, scraped_at)` — alts differ by `line_score`.

### Upsert

`prophetx_props_to_rows` copies `is_main`. If the field is missing (old on-disk JSON), default **`true`** so legacy main-only snapshots still load cleanly. Conflict columns unchanged.

## Scraper behavior

- Replace the **props** path’s use of `pick_main_market_line` with iteration over all `marketLines`.
- Keep `pick_main_market_line` for **team** markets.
- Skip a `marketLine` with no usable over/under selection.
- Empty `marketLines` → skip market (same as today).
- Odds depth unchanged: best (first) resting selection per side + stake; no full order book.

## Prop Picks

- No change to fair tier, edge, or exact-line indexing.
- Once alts land in the latest PX snapshot, a DFS row at 2.5 attaches PX 2.5 even if favourite is 3.5; otherwise still `no_sharp_read` for that book.
- Other books (Parlay / Pinnacle) unchanged; closest-line matching remains out of scope.

## Tests

- Multi-line prop fixture → main + alt rows with correct `is_main`.
- Sole line → `is_main: true`.
- `prophetx_props_to_rows` includes `is_main`; missing field defaults true.
- Optional regression: DFS line matches PX alt while favourite is a different line → PX attaches.

No live ProphetX network calls in CI.

## Out of scope

- Team market alternate lines
- Prop Picks UI badge for alt vs main
- Closest-line matching across books
- Parlay / Pinnacle / DFS alt expansion
- Env-gated scrape modes
- Revising WNBA scrapers

## Success criteria

1. `python -m src.scrapers.mlb_prophetx` writes props JSON with multiple lines per player/stat when ProphetX lists them, each with correct dynamic `is_main`.
2. Upsert stores those rows including `is_main` into `odds.mlb_prophetx`.
3. `/mlb/prop_picks` attaches ProphetX fair on exact DFS line when that line exists as a PX alt.
4. Unit tests pass without hitting ProphetX live.
