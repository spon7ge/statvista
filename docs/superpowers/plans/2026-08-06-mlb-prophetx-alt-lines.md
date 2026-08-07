# MLB ProphetX Prop Alt Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape ProphetX MLB player-prop main + alt lines with dynamic `is_main`, upsert them into `odds.mlb_prophetx`, and let `/mlb/prop_picks` exact-line attach work when DFS sits on a non-favourite line.

**Architecture:** Change `extract_props` to emit one JSON row per usable `marketLine` (team markets stay favourite-only). Add `is_main` through JSON → `prophetx_props_to_rows` → migration `031`. Prop Picks attach logic stays exact-line; add a regression test that a DFS line matches a PX alt while a different favourite exists.

**Tech Stack:** Python scrapers (`src/scrapers/mlb_prophetx.py`), snapshot mappers (`src/odds/`), SQL migrations (`db/migrations/`), FastAPI props assembly (`backend/app/domains/mlb/props.py`), pytest.

## Global Constraints

- Player props only — team markets remain `pick_main_market_line` / favourite-only.
- `is_main` is dynamic per scrape from ProphetX `favourite` (sole line → true); never lock for a game.
- Multiple `favourite: true` lines: first gets `is_main: true`, rest `false`, debug log.
- Missing `is_main` on old JSON defaults to `true` in the upsert mapper.
- No Prop Picks UI badge, no env flag, no closest-line matching, no live ProphetX in CI.
- Branding: product name **statvista** in any user-facing copy (none expected here).

## File map

| File | Role |
| --- | --- |
| `src/scrapers/mlb_prophetx.py` | Emit all prop `marketLines` + `is_main` |
| `src/scrapers/tests/scrapers/test_mlb_prophetx.py` | Scraper unit tests |
| `src/odds/snapshot_rows.py` | Map `is_main` into DB rows |
| `src/scrapers/tests/odds/test_snapshot_rows.py` | Mapper unit tests |
| `db/migrations/031_odds_mlb_prophetx_is_main.sql` | Add `is_main` column |
| `backend/tests/test_mlb_props.py` | Exact-line alt attach regression |
| `docs/superpowers/specs/2026-08-05-mlb-prophetx-scraper-design.md` | Note props now include alts (pointer to new spec) |

---

### Task 1: Scraper emits prop main + alt lines with `is_main`

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py` (`extract_props`; keep `pick_main_market_line` for team)
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`
- Test: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: existing `_sides_from_book`, `best_selection`, `american_and_stake`, `player_name_from_market`, `PROP_SUBTYPE_TO_STAT`
- Produces: `extract_props(markets) -> list[dict]` where each dict includes `is_main: bool` and may include multiple rows per market (one per usable line)

- [ ] **Step 1: Write the failing tests**

Replace `test_extract_props_main_hits_only` and add multi-line / sole-line coverage. Update `_HITS_PROP` so the alt line has real selections:

```python
_HITS_PROP = {
    "id": 460000600,
    "name": "Mike Trout Total Hits",
    "subType": "player_total_hits",
    "type": "total",
    "status": "active",
    "marketLines": [
        {
            "name": "Fixed total 0.5",
            "favourite": True,
            "selections": [
                [{"id": 12, "name": "over 0.5", "odds": -200, "line": 0.5, "stake": 134.33}],
                [{"id": 13, "name": "under 0.5", "odds": 150, "line": 0.5, "stake": 90.0}],
            ],
        },
        {
            "name": "Fixed total 1.5",
            "selections": [
                [{"id": 14, "name": "over 1.5", "odds": 120, "line": 1.5, "stake": 40.0}],
                [{"id": 15, "name": "under 1.5", "odds": -140, "line": 1.5, "stake": 55.0}],
            ],
        },
    ],
}


def test_extract_props_main_and_alt_hits() -> None:
    px = _load_scraper()
    props = px.extract_props([_HITS_PROP, {"subType": "unknown_stat", "name": "X"}])
    assert len(props) == 2
    by_line = {row["line"]: row for row in props}
    main = by_line[0.5]
    alt = by_line[1.5]
    assert main["player"] == "Mike Trout"
    assert main["stat"] == "hits"
    assert main["is_main"] is True
    assert main["over"]["american"] == -200
    assert alt["is_main"] is False
    assert alt["over"]["american"] == 120
    assert alt["under"]["american"] == -140


def test_extract_props_sole_line_is_main() -> None:
    px = _load_scraper()
    market = {
        "id": 1,
        "name": "Mike Trout Total Hits",
        "subType": "player_total_hits",
        "marketLines": [
            {
                "name": "Fixed total 0.5",
                "selections": [
                    [{"name": "over 0.5", "odds": -110, "line": 0.5, "stake": 1}],
                    [{"name": "under 0.5", "odds": -110, "line": 0.5, "stake": 1}],
                ],
            }
        ],
    }
    props = px.extract_props([market])
    assert len(props) == 1
    assert props[0]["is_main"] is True


def test_extract_props_skips_empty_alt_selections() -> None:
    px = _load_scraper()
    market = {
        "id": 2,
        "name": "Mike Trout Total Hits",
        "subType": "player_total_hits",
        "marketLines": [
            {
                "name": "Fixed total 0.5",
                "favourite": True,
                "selections": [
                    [{"name": "over 0.5", "odds": -110, "line": 0.5, "stake": 1}],
                    [{"name": "under 0.5", "odds": -110, "line": 0.5, "stake": 1}],
                ],
            },
            {"name": "Fixed total 1.5", "selections": [[], []]},
        ],
    }
    props = px.extract_props([market])
    assert len(props) == 1
    assert props[0]["line"] == 0.5
```

Keep existing `test_pick_main_market_line_*` tests — team path still uses them.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_props_main_and_alt_hits src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_props_sole_line_is_main src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_props_skips_empty_alt_selections -v`

Expected: FAIL (old `extract_props` returns one row / no `is_main`, or assertion length mismatch)

- [ ] **Step 3: Implement `extract_props` for all lines**

In `src/scrapers/mlb_prophetx.py`, replace `extract_props` with:

```python
def _prop_row_from_book(
    market: dict[str, Any],
    book: dict[str, Any],
    *,
    stat: str,
    sub: str,
    is_main: bool,
) -> dict[str, Any] | None:
    sides = _sides_from_book(book)
    over = under = None
    line: float | None = None
    for side in sides:
        best = best_selection(side)
        if not best:
            continue
        american, stake = american_and_stake(best)
        side_name = str(best.get("name") or "").lower()
        payload = {"american": american, "stake": stake}
        if best.get("line") is not None:
            try:
                line = float(best["line"])
            except (TypeError, ValueError):
                pass
        if side_name.startswith("over"):
            over = payload
        elif side_name.startswith("under"):
            under = payload
    if over is None and under is None:
        return None
    return {
        "player": player_name_from_market(market),
        "stat": stat,
        "line": line,
        "over": over,
        "under": under,
        "market_id": market.get("id"),
        "sub_type": sub,
        "is_main": is_main,
    }


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or "")
        stat = PROP_SUBTYPE_TO_STAT.get(sub)
        if not stat:
            continue
        lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
        if not lines:
            continue
        favourites = [ln for ln in lines if ln.get("favourite") is True]
        if len(favourites) > 1:
            logger.debug(
                "ProphetX prop market %s has %s favourite lines; marking first as is_main",
                market.get("id"),
                len(favourites),
            )
        main_id = id(favourites[0]) if favourites else (id(lines[0]) if len(lines) == 1 else None)
        if favourites:
            # First favourite is main; any later favourite is treated as alt.
            main_id = id(favourites[0])
        for book in lines:
            is_main = id(book) == main_id if main_id is not None else False
            # Sole line with no favourite flag: treat as main.
            if not favourites and len(lines) == 1:
                is_main = True
            row = _prop_row_from_book(market, book, stat=stat, sub=sub, is_main=is_main)
            if row is not None:
                rows.append(row)
    return rows
```

Simplify the `main_id` block when implementing — avoid the redundant assignment above. Intended rules:

```python
favourites = [ln for ln in lines if ln.get("favourite") is True]
if len(favourites) > 1:
    logger.debug(...)
if favourites:
    main_book = favourites[0]
elif len(lines) == 1:
    main_book = lines[0]
else:
    main_book = None  # multiple lines, none favourite → all is_main False

for book in lines:
    is_main = book is main_book
    row = _prop_row_from_book(...)
```

Do **not** change `extract_team_markets`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py -v`

Expected: PASS (including existing team / pick_main tests)

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "$(cat <<'EOF'
feat(scrapers): emit ProphetX MLB prop alt lines with is_main

Iterate all marketLines for player props; keep team markets main-only.
EOF
)"
```

---

### Task 2: Upsert mapper + DB column for `is_main`

**Files:**
- Create: `db/migrations/031_odds_mlb_prophetx_is_main.sql`
- Modify: `src/odds/snapshot_rows.py` (`prophetx_props_to_rows`)
- Modify: `src/scrapers/tests/odds/test_snapshot_rows.py`
- Test: `src/scrapers/tests/odds/test_snapshot_rows.py`

**Interfaces:**
- Consumes: prop JSON rows with optional `is_main`
- Produces: DB row dicts including `"is_main": bool` (default `True` when missing)

- [ ] **Step 1: Write the failing mapper tests**

Add to `src/scrapers/tests/odds/test_snapshot_rows.py`:

```python
def test_prophetx_props_to_rows_copies_is_main():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 1,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"name": "Away", "seq": 0},
                {"name": "Home", "seq": 1},
            ],
            "props": [
                {
                    "player": "Mike Trout",
                    "stat": "hits",
                    "line": 0.5,
                    "is_main": True,
                    "over": {"american": -200, "stake": 1},
                    "under": {"american": 150, "stake": 1},
                    "market_id": 1,
                    "sub_type": "player_total_hits",
                },
                {
                    "player": "Mike Trout",
                    "stat": "hits",
                    "line": 1.5,
                    "is_main": False,
                    "over": {"american": 120, "stake": 1},
                    "under": {"american": -140, "stake": 1},
                    "market_id": 1,
                    "sub_type": "player_total_hits",
                },
            ],
        }
    ]
    rows = prophetx_props_to_rows(games, league="mlb", scraped_at=scraped)
    assert len(rows) == 4
    main_over = next(r for r in rows if float(r["line_score"]) == 0.5 and r["side"] == "over")
    alt_over = next(r for r in rows if float(r["line_score"]) == 1.5 and r["side"] == "over")
    assert main_over["is_main"] is True
    assert alt_over["is_main"] is False


def test_prophetx_props_to_rows_defaults_missing_is_main_true():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 1,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"name": "Away", "seq": 0},
                {"name": "Home", "seq": 1},
            ],
            "props": [
                {
                    "player": "Mike Trout",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": -110, "stake": 1},
                    "under": {"american": -110, "stake": 1},
                    "market_id": 1,
                    "sub_type": "player_total_hits",
                },
            ],
        }
    ]
    rows = prophetx_props_to_rows(games, league="mlb", scraped_at=scraped)
    assert all(r["is_main"] is True for r in rows)
```

Also extend `test_prophetx_props_to_rows_emits_over_under_with_stake` expectations if that fixture still omits `is_main` — after the default, those rows should assert `is_main is True`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_props_to_rows_copies_is_main src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_props_to_rows_defaults_missing_is_main_true -v`

Expected: FAIL with `KeyError: 'is_main'` (or assertion failure)

- [ ] **Step 3: Implement mapper + migration**

Create `db/migrations/031_odds_mlb_prophetx_is_main.sql`:

```sql
-- 031_odds_mlb_prophetx_is_main.sql
-- Flag ProphetX favourite/main prop lines vs alts (dynamic per scrape).

ALTER TABLE odds.mlb_prophetx
    ADD COLUMN IF NOT EXISTS is_main BOOLEAN;
```

In `prophetx_props_to_rows`, when appending each side row, add:

```python
is_main = prop.get("is_main")
if not isinstance(is_main, bool):
    is_main = True
# ... inside rows.append({...}):
"is_main": is_main,
```

Conflict columns in `load_snapshots.py` stay unchanged.

- [ ] **Step 4: Run mapper tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/odds/test_snapshot_rows.py -k prophetx_props -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add db/migrations/031_odds_mlb_prophetx_is_main.sql src/odds/snapshot_rows.py src/scrapers/tests/odds/test_snapshot_rows.py
git commit -m "$(cat <<'EOF'
feat(odds): persist ProphetX prop is_main on upsert

Add mlb_prophetx.is_main and map it from snapshot JSON (default true).
EOF
)"
```

---

### Task 3: Prop Picks regression — DFS matches PX alt line

**Files:**
- Modify: `backend/tests/test_mlb_props.py`
- Test: `backend/tests/test_mlb_props.py`
- No production code change expected (exact-line index already handles alts once present)

**Interfaces:**
- Consumes: `get_mlb_props_today` + `_stub_snapshots` with multiple PX `line_score` rows
- Produces: regression proving alt attach; existing mismatch test remains

- [ ] **Step 1: Write the failing-or-passing regression test**

Add after `test_exact_line_mismatch_omits_book`:

```python
def test_exact_line_attaches_prophetx_alt_when_favourite_differs(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 2.5,
                "side": "over",
                "american_price": -105,
                "is_main": True,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "is_main": False,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "under",
                "american_price": 110,
                "is_main": False,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(
        svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    )

    assert len(response.props) == 1
    row = response.props[0]
    assert row.line == 1.5
    assert row.books.prophetx is not None
    assert row.books.prophetx.american == -130
    assert row.source_tier != "no_sharp_read"
```

Note: `_index_snapshot_rows` ignores unknown fields like `is_main`; attach uses line only. If this already passes on current code, keep it as a lock-in regression.

- [ ] **Step 2: Run the test**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend && python -m pytest tests/test_mlb_props.py::test_exact_line_attaches_prophetx_alt_when_favourite_differs tests/test_mlb_props.py::test_exact_line_mismatch_omits_book -v`

Expected: PASS for both (if attach fails, debug `_index_snapshot_rows` / `_line_key` — do not add closest-line logic)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_mlb_props.py
git commit -m "$(cat <<'EOF'
test(mlb): lock ProphetX alt-line exact attach on prop picks

Prove DFS 1.5 attaches PX alt while favourite is 2.5.
EOF
)"
```

---

### Task 4: Point older scraper spec at alt-lines design

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-mlb-prophetx-scraper-design.md` (Lines / Out of scope rows)
- No new tests

**Interfaces:**
- None (docs only)

- [ ] **Step 1: Update the Decisions table and out-of-scope note**

In `2026-08-05-mlb-prophetx-scraper-design.md`:

- Change Lines row to: **Player props: main + alts with `is_main` (see `2026-08-06-mlb-prophetx-alt-lines-design.md`); team markets: main/favourite only**
- In Out of scope, remove “alternate (non-favourite) lines” for props; keep “full order book”; note team alts remain out of scope
- Architecture bullet: props emit all `marketLines` with `is_main`; team still favourite-only

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-05-mlb-prophetx-scraper-design.md
git commit -m "$(cat <<'EOF'
docs: note ProphetX MLB props now scrape alt lines

Point scraper design at the 2026-08-06 alt-lines spec.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Props emit all usable `marketLines` | Task 1 |
| Dynamic `is_main` from `favourite` / sole line | Task 1 |
| Multiple favourites → first main + debug | Task 1 |
| Team markets unchanged | Task 1 (no code change) |
| JSON `is_main` | Task 1 |
| Migration `031` + upsert map + default true | Task 2 |
| Prop Picks exact attach for alts | Task 3 |
| No UI badge / no env flag / no closest-line | Global constraints |
| Update related scraper design | Task 4 |

## Placeholder scan

None intentional. `main_id` redundancy in Task 1 Step 3 is corrected by the simplified block in the same step — implement the simplified version only.
