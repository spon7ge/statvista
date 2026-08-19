# MLB Parlay API Odds Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `odds.mlb_parlay_api_odds` and serve MLB prop-board Parlay sportsbooks (DK/FD/cmp + `books_main`) from that snapshot only — no live Parlay fallback.

**Architecture:** Mirror WNBA’s unified Parlay table. Generalize the loader to pick `wnba_parlay_api_odds` vs `mlb_parlay_api_odds` by league. Persist from raw Parlay rows inside `fetch_mlb_parlay_props_normalized` (throttled). `get_mlb_props_today` / game props build Parlay `SideIndex` from `fetch_latest_parlay_api_odds("mlb")` and never pass live `parlay.book_indexes` into assembly.

**Tech Stack:** Postgres migrations, `src/odds/*` loaders, FastAPI MLB props assemble, pytest

## Global Constraints

- Product name: **statvista**
- Serve books only: `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`
- No live Parlay fallback for assembly (empty snapshot → empty those columns + `parlay_unavailable` when empty)
- Live Parlay remains the **writer** only (throttled side-effect)
- PrizePicks / Underdog / ProphetX / Novig / Pinnacle scrapers unchanged
- WNBA persist target stays `wnba_parlay_api_odds`; WNBA serve stays live Parlay
- Pinnacle never written from Parlay
- Spec: `docs/superpowers/specs/2026-08-19-mlb-parlay-api-odds-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `db/migrations/039_odds_mlb_parlay_api_odds.sql` | Create `odds.mlb_parlay_api_odds` |
| `src/odds/quote_specs.py` | Register `mlb_parlay_api_odds` |
| `src/odds/snapshot_rows.py` | Allow `kalshi` / `fliff` in `_PARLAY_BOOKS` |
| `src/odds/parlay_main_lines.py` | Allow kalshi/fliff in Parlay book frozenset if needed for main-line select |
| `src/odds/load_snapshots.py` | League → table; MLB books tuple; persist routing |
| `src/scrapers/tests/odds/test_load_snapshots.py` | Persist table routing / MLB books tests |
| `src/scrapers/tests/odds/test_quote_specs.py` | Spec registration |
| `backend/app/core/odds_snapshots.py` | `fetch_latest_parlay_api_odds(league)` |
| `backend/app/domains/mlb/props.py` | Index snapshot → SideIndex; assemble from snapshot only; error rules |
| `backend/app/providers/parlay/mlb_props.py` | Persist raw rows after successful fetch |
| `backend/app/domains/mlb/game_props.py` | Same snapshot serve (no live book_indexes) |
| `backend/tests/test_mlb_props.py` | Serve-from-snapshot + no-live-fallback tests |
| `backend/tests/test_odds_snapshots_*.py` or new | Fetch SQL table name tests |
| `md/system-design.md` | `/mlb/prop_picks` Parlay source note |

---

### Task 1: Migration `odds.mlb_parlay_api_odds`

**Files:**
- Create: `db/migrations/039_odds_mlb_parlay_api_odds.sql`

**Interfaces:**
- Produces: table `odds.mlb_parlay_api_odds` matching WNBA `025` shape

- [ ] **Step 1: Add migration**

Copy `db/migrations/025_odds_wnba_parlay_api_odds.sql` → `039_odds_mlb_parlay_api_odds.sql`, rename table/index to `mlb_parlay_api_odds` / `odds_mlb_parlay_api_odds_league_scraped_at_idx`.

- [ ] **Step 2: Commit**

```bash
git add db/migrations/039_odds_mlb_parlay_api_odds.sql \
  docs/superpowers/specs/2026-08-19-mlb-parlay-api-odds-design.md
git commit -m "$(cat <<'EOF'
db: add odds.mlb_parlay_api_odds for Parlay sportsbook snapshots

EOF
)"
```

---

### Task 2: Loader — league-routed table + MLB books (kalshi/fliff)

**Files:**
- Modify: `src/odds/load_snapshots.py`
- Modify: `src/odds/quote_specs.py`
- Modify: `src/odds/snapshot_rows.py`
- Modify: `src/odds/parlay_main_lines.py` (if `SPORTSBOOK_BOOKS` / `PARLAY_PROP_BOOKS` omit kalshi/fliff)
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py`
- Modify: `src/scrapers/tests/odds/test_quote_specs.py`

**Interfaces:**
- Produces:
  - `parlay_api_odds_table(league: str) -> str` → `wnba_parlay_api_odds` | `mlb_parlay_api_odds`
  - `MLB_PARLAY_PROP_SPORTSBOOKS = ("fanduel", "draftkings", "caesars", "betmgm", "bet365", "kalshi", "fliff", ...)` — must include all serve books; may include extra Parlay books
  - `load_parlay_api_odds_snapshot` / `maybe_persist_parlay_props` / `latest_parlay_props_scraped_at` use table from league
  - `get_quote_spec("mlb_parlay_api_odds")` works

- [ ] **Step 1: Write failing tests**

In `test_load_snapshots.py`:

```python
def test_parlay_api_odds_table_routes_by_league():
    assert load_snapshots.parlay_api_odds_table("wnba") == "wnba_parlay_api_odds"
    assert load_snapshots.parlay_api_odds_table("mlb") == "mlb_parlay_api_odds"


def test_maybe_persist_parlay_props_mlb_writes_mlb_table(monkeypatch, mock_upsert):
    # stub should_persist True; pass sample Parlay rows with draftkings + kalshi
    counts = load_snapshots.maybe_persist_parlay_props(ROWS, league="mlb")
    assert mock_upsert.last_table == "mlb_parlay_api_odds"
    assert "kalshi" in load_snapshots.MLB_PARLAY_PROP_SPORTSBOOKS
    assert "fliff" in load_snapshots.MLB_PARLAY_PROP_SPORTSBOOKS


def test_maybe_persist_parlay_props_wnba_still_wnba_table(monkeypatch, mock_upsert):
    load_snapshots.maybe_persist_parlay_props(ROWS, league="wnba")
    assert mock_upsert.last_table == "wnba_parlay_api_odds"
```

Adapt to existing `mock_upsert` helpers in that file (inspect how WNBA tests assert table name).

In `test_quote_specs.py`:

```python
def test_mlb_parlay_api_odds_quote_spec_registered():
    spec = get_quote_spec("mlb_parlay_api_odds")
    assert spec is not None
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=. pytest src/scrapers/tests/odds/test_load_snapshots.py src/scrapers/tests/odds/test_quote_specs.py -q -k "parlay_api_odds or mlb_parlay"`

- [ ] **Step 3: Implement**

1. `src/odds/quote_specs.py` — add `"mlb_parlay_api_odds": _PARLAY_PROPS`.
2. `src/odds/snapshot_rows.py` — add `"kalshi"`, `"fliff"` to `_PARLAY_BOOKS`.
3. `src/odds/parlay_main_lines.py` — add kalshi/fliff to the sportsbook allowlist used by `select_parlay_main_lines` if missing.
4. `src/odds/load_snapshots.py`:
   - Replace hard-coded `_PARLAY_API_ODDS_TABLE = "wnba_parlay_api_odds"` with:

```python
def parlay_api_odds_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_parlay_api_odds"
    return "wnba_parlay_api_odds"  # wnba / default
```

   - `MLB_PARLAY_PROP_SPORTSBOOKS`: include at least  
     `fanduel`, `draftkings`, `caesars`, `betmgm`, `bet365`, `kalshi`, `fliff`  
     (optionally also prizepicks/underdog/novig/… for archive; serve path will filter).
   - `load_parlay_api_odds_snapshot`: resolve table via `parlay_api_odds_table(league)`; when `league=="mlb"` default `books=MLB_PARLAY_PROP_SPORTSBOOKS`.
   - `latest_parlay_props_scraped_at(league)` / `should_persist_parlay_props` / `maybe_persist_parlay_props`: use league table; for MLB pass MLB books tuple.
   - Update docstrings that say “only wnba_parlay_api_odds”.

- [ ] **Step 4: Run — expect PASS**

Run: `PYTHONPATH=. pytest src/scrapers/tests/odds/test_load_snapshots.py src/scrapers/tests/odds/test_quote_specs.py src/scrapers/tests/odds/test_snapshot_rows.py -q`

- [ ] **Step 5: Commit**

```bash
git add src/odds/load_snapshots.py src/odds/quote_specs.py \
  src/odds/snapshot_rows.py src/odds/parlay_main_lines.py \
  src/scrapers/tests/odds/test_load_snapshots.py \
  src/scrapers/tests/odds/test_quote_specs.py
git commit -m "$(cat <<'EOF'
feat(odds): route Parlay API snapshots to mlb_parlay_api_odds

EOF
)"
```

---

### Task 3: Persist on MLB Parlay fetch

**Files:**
- Modify: `backend/app/providers/parlay/mlb_props.py`
- Modify: `backend/tests/test_parlay_mlb_props.py`

**Interfaces:**
- Consumes: `maybe_persist_parlay_props(raw_rows, league="mlb")`
- Produces: successful `fetch_mlb_parlay_props_normalized` best-effort persists filtered raw rows before returning normalized result

- [ ] **Step 1: Write failing test**

```python
@pytest.mark.asyncio
async def test_fetch_mlb_parlay_persists_snapshot(monkeypatch):
    called = {}

    def fake_persist(rows, *, league="wnba", scraped_at=None):
        called["league"] = league
        called["n"] = len(rows)
        return {"draftkings": 1}

    monkeypatch.setattr(
        "src.odds.load_snapshots.maybe_persist_parlay_props", fake_persist
    )
    # stub parlay_get to return a small valid payload with draftkings bookmaker
    ...
    out = await fetch_mlb_parlay_props_normalized()
    assert called.get("league") == "mlb"
    assert called.get("n", 0) > 0
    assert out.unavailable is False
```

Also assert: when `parlay_get` raises / returns empty, persist is **not** called (or called with empty and no-ops).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_parlay_mlb_props.py -k persist -v`

- [ ] **Step 3: Implement**

In `fetch_mlb_parlay_props_normalized`, after building `rows` (filtered allowlist) and before/after `normalize_parlay_mlb_props(rows)`:

```python
try:
    from src.odds.load_snapshots import maybe_persist_parlay_props
    maybe_persist_parlay_props(rows, league="mlb")
except Exception:
    logger.exception("MLB Parlay snapshot persist failed")
```

Prefer try/except so persist never breaks fetch. Do **not** persist on soft-empty `unavailable=True` from HTTP failure (no rows). Empty successful slate may no-op inside loader.

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_parlay_mlb_props.py -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/parlay/mlb_props.py backend/tests/test_parlay_mlb_props.py
git commit -m "$(cat <<'EOF'
feat(mlb): persist Parlay props into mlb_parlay_api_odds on fetch

EOF
)"
```

---

### Task 4: Fetch + index snapshot into Parlay SideIndex

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Create or modify: `backend/tests/test_odds_snapshots_mlb_parlay.py` (or extend existing snapshot tests)
- Modify: `backend/app/domains/mlb/props.py` — add `_index_parlay_api_odds_rows` helper (or module-level function used by props + game_props)

**Interfaces:**
- Produces:
  - `fetch_latest_parlay_api_odds(league: str = "mlb") -> list[dict]`  
    Columns: `sportsbook, player_name, market_type, side, line_score, american_price, scraped_at` from `odds.{league}_parlay_api_odds` latest-per-identity (same DISTINCT ON pattern as other prop tables / quote_spec).
  - `index_parlay_api_odds_by_book(rows: list[dict]) -> dict[str, SideIndex]`  
    Groups by sportsbook; SideKey = `(norm_player, canonical_stat, side, line)`; uses `canonical_stat_key_from_sharp_mlb(market_type)`; sets `american`, `fair_pct` via `american_to_fair_pct`, `changed_at` from `scraped_at`.

- [ ] **Step 1: Write failing tests**

```python
def test_fetch_latest_parlay_api_odds_mlb_sql():
    sql = ...  # capture from fetch or unit the table map
    assert "mlb_parlay_api_odds" in sql


def test_index_parlay_api_odds_by_book_builds_side_keys():
    rows = [
        {
            "sportsbook": "draftkings",
            "player_name": "Aaron Judge",
            "market_type": "batter_home_runs",
            "side": "over",
            "line_score": 0.5,
            "american_price": -130,
            "scraped_at": "...",
        },
        {
            "sportsbook": "kalshi",
            "player_name": "Aaron Judge",
            "market_type": "batter_home_runs",
            "side": "under",
            "line_score": 0.5,
            "american_price": 110,
            "scraped_at": "...",
        },
    ]
    indexes = index_parlay_api_odds_by_book(rows)
    assert "draftkings" in indexes
    assert "kalshi" in indexes
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

1. In `odds_snapshots.py` add `_PARLAY_API_ODDS_TABLE` map (`mlb` / `wnba`) and `fetch_latest_parlay_api_odds` using `get_quote_spec(table)` + existing `_latest_snapshot_sql` / execute pattern (mirror `fetch_latest_pinnacle`).
2. In `mlb/props.py` (or small helper module under `mlb/`) implement `index_parlay_api_odds_by_book` using the same SideKey conventions as Parlay normalize (`_norm_player`, `_line_key`, `canonical_stat_key_from_sharp_mlb`).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/odds_snapshots.py backend/app/domains/mlb/props.py \
  backend/tests/test_odds_snapshots_mlb_parlay.py  # or whatever test file used
git commit -m "$(cat <<'EOF'
feat(api): fetch and index MLB Parlay API odds snapshots

EOF
)"
```

---

### Task 5: Serve MLB props from snapshot only (no live book_indexes)

**Files:**
- Modify: `backend/app/domains/mlb/props.py` (`get_mlb_props_today`)
- Modify: `backend/app/domains/mlb/game_props.py`
- Modify: `backend/tests/test_mlb_props.py`
- Modify: `backend/tests/test_mlb_game_props.py` as needed

**Interfaces:**
- Consumes: `fetch_latest_parlay_api_odds("mlb")`, `index_parlay_api_odds_by_book`
- Produces: `_assemble_rows(..., parlay.book_indexes replaced by snapshot indexes)`; live fetch still runs for persist only

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.asyncio
async def test_mlb_props_parlay_books_from_snapshot_not_live(monkeypatch):
    # Live Parlay returns Wrong Book / Wrong Player indexes
    # Snapshot returns Aaron Judge draftkings main
    # Assert assembled books_main.draftkings / books.draftkings match snapshot
    # Assert Wrong Player never appears


@pytest.mark.asyncio
async def test_mlb_props_empty_snapshot_parlay_unavailable(monkeypatch):
    # Live Parlay healthy with full book_indexes
    # Snapshot fetch returns []
    # Assert error == "parlay_unavailable" (or includes it per precedence with seed_error)
    # Assert props either empty of parlay books or books_main.draftkings is None
```

Update existing tests that stub only live Parlay books: also stub `fetch_latest_parlay_api_odds` with equivalent rows, **or** they will fail under the new serve path.

Error precedence (align with spec):
- Empty Parlay snapshot → `parlay_unavailable` for the Parlay-books signal
- Do not clear DFS rows solely because Parlay snapshot is empty
- `prizepicks_unavailable` still wins / coexists per existing seed rules — if both empty, prefer documenting both; minimum: snapshot empty sets `parlay_unavailable` when no prior token, or sets it when seed succeeded

- [ ] **Step 2: Run targeted mlb props tests — expect FAIL**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_props.py -k "parlay or snapshot or books_main" -v`

- [ ] **Step 3: Implement `get_mlb_props_today`**

```python
# 1) Live fetch (persist side-effect inside provider) — ignore book_indexes for assemble
parlay = await fetch_mlb_parlay_props_normalized(...)

# 2) Snapshot serve
snap_rows = fetch_latest_parlay_api_odds("mlb")
snapshot_indexes = index_parlay_api_odds_by_book(snap_rows)
# optionally filter to SERVE_BOOKS only

if not snap_rows:
    parlay_error = "parlay_unavailable"
# else: do not set parlay_error from live failure alone if snapshot has rows

parlay_mains = {
    book: _main_from_side_index(snapshot_indexes.get(book, {}))
    for book in ("draftkings", "fanduel", "betmgm", "caesars", "kalshi", "fliff", "bet365")
}

rows = _assemble_rows(
    ...,
    parlay_book_indexes=snapshot_indexes,  # NOT parlay.book_indexes
    parlay_mains=parlay_mains,
    ...
)
```

Apply the same snapshot serve pattern in `game_props.py` where it currently spreads `**parlay.book_indexes`.

- [ ] **Step 4: Fix / update all `test_mlb_props.py` stubs** so Parlay books come from `fetch_latest_parlay_api_odds` stubs. Keep live Parlay stub for persist/availability tests.

- [ ] **Step 5: Run full MLB props + game props tests — expect PASS**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_props.py tests/test_mlb_game_props.py tests/test_parlay_mlb_props.py -q`

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/props.py backend/app/domains/mlb/game_props.py \
  backend/tests/test_mlb_props.py backend/tests/test_mlb_game_props.py
git commit -m "$(cat <<'EOF'
feat(mlb): serve prop books from mlb_parlay_api_odds snapshot only

EOF
)"
```

---

### Task 6: Docs

**Files:**
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-19-mlb-parlay-api-odds-design.md` (Status → Implemented)

- [ ] **Step 1: Update system-design**

On `/mlb/prop_picks` (and game props note if it mentions live Parlay indexes): Parlay sportsbooks (DK/FD/BetMGM/Caesars/Kalshi/Fliff/bet365) from latest `odds.mlb_parlay_api_odds`; live Parlay fetch only refreshes that table (throttled); empty snapshot → `parlay_unavailable` / NL — no live fallback.

- [ ] **Step 2: Commit**

```bash
git add md/system-design.md \
  docs/superpowers/specs/2026-08-19-mlb-parlay-api-odds-design.md
git commit -m "$(cat <<'EOF'
docs: MLB Parlay API odds snapshot serve path

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Migration `odds.mlb_parlay_api_odds` | 1 |
| League-routed loader; WNBA unchanged | 2 |
| MLB write includes kalshi/fliff | 2 |
| Persist on MLB Parlay fetch | 3 |
| `fetch_latest` + SideIndex | 4 |
| Serve from snapshot only | 5 |
| Empty snapshot → no live fallback + error | 5 |
| Game props same serve rule | 5 |
| system-design + spec Implemented | 6 |

## Plan self-review

- Spec “empty snapshot never uses live rows” enforced in Task 5 tests with deliberately conflicting live indexes.
- Persist needs **raw** Parlay rows — Task 3 hooks the provider before normalize discards them.
- kalshi/fliff gap in `_PARLAY_BOOKS` / loader tuples called out in Task 2 (would silently drop those books otherwise).
- WNBA `maybe_persist_parlay_props(league="wnba")` path remains default table.
- No TBD placeholders; OpenAPI unchanged (response shape same).
