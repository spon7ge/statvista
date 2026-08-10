# Odds Change-Only Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert odds snapshot rows only when line/points or price fields differ from the latest stored quote for that identity; update board readers to latest-per-quote; add a one-time prune for historical no-op duplicates.

**Architecture:** A shared quote-spec registry + pure DataFrame filter compares each incoming row to `DISTINCT ON (identity)` latest DB state, then existing `upsert_df` writes only kept rows. API readers switch from `scraped_at = MAX(scraped_at)` to the same latest-per-identity semantics. A separate operator script prunes already-stored unchanged repeats.

**Tech Stack:** Python, pandas, SQLAlchemy/`src.utils.db.get_engine`, pytest, FastAPI backend odds readers

## Global Constraints

- Change history (not latest-only overwrite)
- Change = line/points **or** any compare price field (null-safe)
- All scraper odds loaders in `src/odds/load_snapshots.py` (props + team, MLB + WNBA, Sharp/Parlay)
- No schema / PK migrations
- Vanished-quote tombstones out of scope
- Sharp/Parlay time throttles keep using `MAX(scraped_at)`
- Product name **statvista** in any new user-facing copy
- Do not commit unless the user explicitly asks
- Spec: `docs/superpowers/specs/2026-08-10-odds-change-only-snapshots-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/odds/quote_specs.py` | Per-table quote identity + compare column registry; shared by filter, readers helpers, prune |
| `src/odds/change_filter.py` | Pure filter + DB latest-quote fetch used before upsert |
| `src/odds/load_snapshots.py` | Call filter in every `load_*` / Sharp / Parlay path before `upsert_df` |
| `backend/app/core/odds_snapshots.py` | Board SQL: latest row per quote identity |
| `scripts/prune_odds_unchanged_snapshots.py` | One-time prune with `--dry-run` / `--apply` |
| `src/scrapers/tests/odds/test_quote_specs.py` | Registry sanity |
| `src/scrapers/tests/odds/test_change_filter.py` | Filter unit tests |
| `src/scrapers/tests/odds/test_load_snapshots.py` | Wire-up: unchanged skipped, changed upserted |
| `backend/tests/test_odds_snapshots_mlb_props.py` | Assert DISTINCT ON / no max-batch board SQL |
| `backend/tests/test_odds_snapshots_latest_per_quote.py` | SQL helper shape for PP/UD/team fetchers |

---

### Task 1: Quote specs registry (TDD)

**Files:**
- Create: `src/odds/quote_specs.py`
- Test: `src/scrapers/tests/odds/test_quote_specs.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class QuoteSpec: identity_cols: tuple[str, ...]; compare_cols: tuple[str, ...]`
  - `QUOTE_SPECS: dict[str, QuoteSpec]` keyed by odds table name (no schema prefix)
  - `def get_quote_spec(table: str) -> QuoteSpec`

- [ ] **Step 1: Write failing tests**

```python
# src/scrapers/tests/odds/test_quote_specs.py
from src.odds.quote_specs import QUOTE_SPECS, get_quote_spec


def test_prizepicks_identity_excludes_line_and_scraped_at():
    spec = get_quote_spec("wnba_prizepicks")
    assert spec.identity_cols == ("league", "player_name", "stat_type", "odds_type")
    assert "line_score" in spec.compare_cols
    assert "scraped_at" not in spec.identity_cols
    assert "scraped_at" not in spec.compare_cols


def test_underdog_compares_line_and_prices():
    spec = get_quote_spec("mlb_underdogs")
    assert spec.identity_cols == ("league", "player_name", "stat_name", "side")
    assert spec.compare_cols == ("line_score", "american_price", "payout_multiplier")


def test_parlay_unified_includes_sportsbook():
    spec = get_quote_spec("wnba_parlay_api_odds")
    assert "sportsbook" in spec.identity_cols
    assert spec.compare_cols == ("line_score", "american_price")


def test_pinnacle_team_keeps_period_and_is_alternate():
    spec = get_quote_spec("mlb_pinnacle_team")
    assert spec.identity_cols == (
        "league",
        "away_team",
        "home_team",
        "market_type",
        "period",
        "is_alternate",
        "side",
    )
    assert "points" in spec.compare_cols
    assert "american_price" in spec.compare_cols


def test_novig_props_include_event_id():
    spec = get_quote_spec("mlb_novig")
    assert spec.identity_cols == (
        "league",
        "event_id",
        "player_name",
        "stat_name",
        "side",
    )
    assert "stake" in spec.compare_cols


def test_unknown_table_raises():
    import pytest

    with pytest.raises(KeyError):
        get_quote_spec("not_a_real_table")


def test_registry_covers_loader_tables():
    required = {
        "wnba_prizepicks",
        "mlb_prizepicks",
        "wnba_underdogs",
        "mlb_underdogs",
        "wnba_pinnacle",
        "mlb_pinnacle",
        "wnba_pinnacle_team",
        "mlb_pinnacle_team",
        "wnba_fanduel",
        "wnba_draftkings",
        "wnba_parlay_api_odds",
        "mlb_prophetx",
        "mlb_prophetx_team",
        "mlb_novig",
        "mlb_novig_team",
        "wnba_novig",
        "wnba_novig_team",
    }
    assert required <= set(QUOTE_SPECS)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/odds/test_quote_specs.py -v`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement registry**

```python
# src/odds/quote_specs.py
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class QuoteSpec:
    identity_cols: tuple[str, ...]
    compare_cols: tuple[str, ...]


_PRIZEPICKS = QuoteSpec(
    identity_cols=("league", "player_name", "stat_type", "odds_type"),
    compare_cols=("line_score",),
)
_UNDERDOG = QuoteSpec(
    identity_cols=("league", "player_name", "stat_name", "side"),
    compare_cols=("line_score", "american_price", "payout_multiplier"),
)
_BOOK_PROPS = QuoteSpec(
    identity_cols=("league", "player_name", "market_type", "side"),
    compare_cols=("line_score", "american_price"),
)
_PARLAY_PROPS = QuoteSpec(
    identity_cols=("sportsbook", "league", "player_name", "market_type", "side"),
    compare_cols=("line_score", "american_price"),
)
_PINNACLE_TEAM = QuoteSpec(
    identity_cols=(
        "league",
        "away_team",
        "home_team",
        "market_type",
        "period",
        "is_alternate",
        "side",
    ),
    compare_cols=("points", "american_price", "decimal_price"),
)
_EXCHANGE_PROPS = QuoteSpec(
    identity_cols=("league", "event_id", "player_name", "stat_name", "side"),
    compare_cols=("line_score", "american_price", "stake"),
)
_EXCHANGE_TEAM = QuoteSpec(
    identity_cols=("league", "event_id", "market_type", "side"),
    compare_cols=("points", "american_price", "stake"),
)

QUOTE_SPECS: dict[str, QuoteSpec] = {
    "wnba_prizepicks": _PRIZEPICKS,
    "mlb_prizepicks": _PRIZEPICKS,
    "wnba_underdogs": _UNDERDOG,
    "mlb_underdogs": _UNDERDOG,
    "wnba_pinnacle": _BOOK_PROPS,
    "mlb_pinnacle": _BOOK_PROPS,
    "wnba_fanduel": _BOOK_PROPS,
    "wnba_draftkings": _BOOK_PROPS,
    "wnba_parlay_api_odds": _PARLAY_PROPS,
    "wnba_pinnacle_team": _PINNACLE_TEAM,
    "mlb_pinnacle_team": _PINNACLE_TEAM,
    "mlb_prophetx": _EXCHANGE_PROPS,
    "mlb_prophetx_team": _EXCHANGE_TEAM,
    "mlb_novig": _EXCHANGE_PROPS,
    "mlb_novig_team": _EXCHANGE_TEAM,
    "wnba_novig": _EXCHANGE_PROPS,
    "wnba_novig_team": _EXCHANGE_TEAM,
}


def get_quote_spec(table: str) -> QuoteSpec:
    return QUOTE_SPECS[table]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/odds/test_quote_specs.py -v`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/odds/quote_specs.py src/scrapers/tests/odds/test_quote_specs.py
git commit -m "feat(odds): add quote identity/compare specs for change-only snapshots"
```

---

### Task 2: Pure change filter (TDD)

**Files:**
- Create: `src/odds/change_filter.py`
- Test: `src/scrapers/tests/odds/test_change_filter.py`

**Interfaces:**
- Consumes: `QuoteSpec` / `get_quote_spec` from Task 1
- Produces:
  - `def values_equal(a, b) -> bool` (null-safe; treat NaN as null; numeric tolerance via `math.isclose` for floats)
  - `def filter_unchanged_quotes(df: pd.DataFrame, *, latest: pd.DataFrame, spec: QuoteSpec) -> tuple[pd.DataFrame, int]`  
    Returns `(kept_df, skipped_count)`. `latest` must contain identity + compare cols (may be empty).

- [ ] **Step 1: Write failing tests**

```python
# src/scrapers/tests/odds/test_change_filter.py
import pandas as pd

from src.odds.change_filter import filter_unchanged_quotes
from src.odds.quote_specs import get_quote_spec


def _pp_row(**kwargs):
    base = {
        "league": "wnba",
        "player_name": "A'ja Wilson",
        "stat_type": "Points",
        "odds_type": "standard",
        "line_score": 22.5,
        "scraped_at": "2026-08-10T12:00:00+00:00",
    }
    base.update(kwargs)
    return base


def test_keeps_new_quote_when_latest_empty():
    df = pd.DataFrame([_pp_row()])
    kept, skipped = filter_unchanged_quotes(
        df, latest=pd.DataFrame(), spec=get_quote_spec("wnba_prizepicks")
    )
    assert len(kept) == 1
    assert skipped == 0


def test_skips_identical_line():
    df = pd.DataFrame([_pp_row(scraped_at="2026-08-10T13:00:00+00:00")])
    latest = pd.DataFrame([_pp_row(scraped_at="2026-08-10T12:00:00+00:00")])
    kept, skipped = filter_unchanged_quotes(
        df, latest=latest, spec=get_quote_spec("wnba_prizepicks")
    )
    assert kept.empty
    assert skipped == 1


def test_keeps_line_change():
    df = pd.DataFrame([_pp_row(line_score=23.5)])
    latest = pd.DataFrame([_pp_row(line_score=22.5)])
    kept, skipped = filter_unchanged_quotes(
        df, latest=latest, spec=get_quote_spec("wnba_prizepicks")
    )
    assert len(kept) == 1
    assert skipped == 0


def test_keeps_price_only_change_underdog():
    spec = get_quote_spec("mlb_underdogs")
    row = {
        "league": "mlb",
        "player_name": "Judge",
        "stat_name": "home_runs",
        "side": "over",
        "line_score": 0.5,
        "american_price": -120,
        "payout_multiplier": 0.94,
    }
    df = pd.DataFrame([{**row, "american_price": -115}])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert len(kept) == 1
    assert skipped == 0


def test_null_prices_equal():
    spec = get_quote_spec("mlb_underdogs")
    row = {
        "league": "mlb",
        "player_name": "Judge",
        "stat_name": "home_runs",
        "side": "over",
        "line_score": 0.5,
        "american_price": None,
        "payout_multiplier": None,
    }
    df = pd.DataFrame([row])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert kept.empty
    assert skipped == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/odds/test_change_filter.py -v`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement filter**

```python
# src/odds/change_filter.py
from __future__ import annotations

import math
from typing import Any

import pandas as pd

from src.odds.quote_specs import QuoteSpec


def _is_null(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def values_equal(left: Any, right: Any) -> bool:
    if _is_null(left) and _is_null(right):
        return True
    if _is_null(left) or _is_null(right):
        return False
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        if isinstance(left, bool) or isinstance(right, bool):
            return left == right
        return math.isclose(float(left), float(right), rel_tol=0.0, abs_tol=1e-9)
    return left == right


def _identity_key(row: pd.Series, identity_cols: tuple[str, ...]) -> tuple:
    return tuple(row.get(col) for col in identity_cols)


def filter_unchanged_quotes(
    df: pd.DataFrame,
    *,
    latest: pd.DataFrame,
    spec: QuoteSpec,
) -> tuple[pd.DataFrame, int]:
    if df.empty:
        return df.copy(), 0

    latest_map: dict[tuple, pd.Series] = {}
    if latest is not None and not latest.empty:
        for _, row in latest.iterrows():
            latest_map[_identity_key(row, spec.identity_cols)] = row

    keep_idx: list[int] = []
    skipped = 0
    for idx, row in df.iterrows():
        prior = latest_map.get(_identity_key(row, spec.identity_cols))
        if prior is None:
            keep_idx.append(idx)
            continue
        changed = any(
            not values_equal(row.get(col), prior.get(col)) for col in spec.compare_cols
        )
        if changed:
            keep_idx.append(idx)
        else:
            skipped += 1

    return df.loc[keep_idx].copy(), skipped
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/odds/test_change_filter.py -v`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/odds/change_filter.py src/scrapers/tests/odds/test_change_filter.py
git commit -m "feat(odds): filter unchanged quotes before snapshot upsert"
```

---

### Task 3: Fetch latest quotes from DB + wire into loaders

**Files:**
- Modify: `src/odds/change_filter.py` (add `fetch_latest_quotes`)
- Modify: `src/odds/load_snapshots.py` (call filter in every load path)
- Test: `src/scrapers/tests/odds/test_load_snapshots.py`
- Test: `src/scrapers/tests/odds/test_change_filter.py` (SQL shape / mock engine optional)

**Interfaces:**
- Produces:
  - `def fetch_latest_quotes(table: str, *, league: str, spec: QuoteSpec) -> pd.DataFrame`
  - `def apply_change_filter(table: str, df: pd.DataFrame, *, league: str) -> pd.DataFrame`  
    Honors `ODDS_SKIP_CHANGE_FILTER` in `{1,true,yes}`; logs kept/skipped; returns filtered df
- Consumes: `get_engine` from `src.utils.db`, `filter_unchanged_quotes`, `get_quote_spec`

- [ ] **Step 1: Write failing loader tests**

Add to `src/scrapers/tests/odds/test_load_snapshots.py`:

```python
def test_load_prizepicks_skips_unchanged_quotes(mock_upsert, monkeypatch):
    monkeypatch.setattr(
        load_snapshots,
        "apply_change_filter",
        lambda table, df, league: df.iloc[0:0],
    )
    count = load_snapshots.load_prizepicks_snapshot(
        PRIZEPICKS_PROJECTIONS, league="wnba", scraped_at=SCRAPED
    )
    assert count == 0
    mock_upsert.assert_not_called()


def test_load_prizepicks_upserts_when_filter_keeps_rows(mock_upsert, monkeypatch):
    def keep_all(table, df, league):
        return df

    monkeypatch.setattr(load_snapshots, "apply_change_filter", keep_all)
    count = load_snapshots.load_prizepicks_snapshot(
        PRIZEPICKS_PROJECTIONS, league="wnba", scraped_at=SCRAPED
    )
    assert count == 1
    mock_upsert.assert_called_once()
```

Also update **every existing** `load_*` test that expects upsert so they either monkeypatch `apply_change_filter` to identity, or monkeypatch `fetch_latest_quotes` to empty — otherwise tests may hit the DB. Preferred: in the existing `mock_upsert` fixture, also patch:

```python
@pytest.fixture
def mock_upsert(monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr(load_snapshots, "upsert_df", mock)
    monkeypatch.setattr(
        load_snapshots,
        "apply_change_filter",
        lambda table, df, league: df,
    )
    return mock
```

Then the two new tests above override that patch as needed.

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py::test_load_prizepicks_skips_unchanged_quotes -v`  
Expected: FAIL (`apply_change_filter` missing or upsert still called)

- [ ] **Step 3: Implement fetch + apply helpers**

Add to `src/odds/change_filter.py`:

```python
import logging
import os

from sqlalchemy import text

from src.odds.quote_specs import get_quote_spec

logger = logging.getLogger(__name__)


def _skip_change_filter() -> bool:
    return os.environ.get("ODDS_SKIP_CHANGE_FILTER", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }


def fetch_latest_quotes(table: str, *, league: str, spec: QuoteSpec) -> pd.DataFrame:
    from src.utils.db import get_engine

    cols = list(dict.fromkeys([*spec.identity_cols, *spec.compare_cols]))
    col_sql = ", ".join(f'"{c}"' for c in cols)
    identity_sql = ", ".join(f'"{c}"' for c in spec.identity_cols)
    order_sql = identity_sql + ', "scraped_at" DESC'
    sql = text(
        f"""
SELECT DISTINCT ON ({identity_sql}) {col_sql}
FROM odds.{table}
WHERE league = :league
ORDER BY {order_sql}
"""
    )
    engine = get_engine()
    with engine.connect() as conn:
        return pd.read_sql(sql, conn, params={"league": league})


def apply_change_filter(table: str, df: pd.DataFrame, *, league: str) -> pd.DataFrame:
    if df.empty or _skip_change_filter():
        return df
    spec = get_quote_spec(table)
    latest = fetch_latest_quotes(table, league=league, spec=spec)
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    if skipped:
        logger.info(
            "odds change filter table=%s league=%s kept=%s skipped_unchanged=%s",
            table,
            league,
            len(kept),
            skipped,
        )
    return kept
```

- [ ] **Step 4: Wire into every loader in `load_snapshots.py`**

Import `apply_change_filter` from `src.odds.change_filter`.

After `_dedupe_conflict_rows(...)` and before empty-check / `upsert_df`, for each loader:

```python
df = apply_change_filter(table_name, df, league=league)
if df.empty:
    return 0  # or empty counts dict for multi-book loaders
```

Apply to:
- `load_prizepicks_snapshot`
- `load_underdog_snapshot`
- `load_pinnacle_props_snapshot`
- `load_pinnacle_team_snapshot`
- `load_prophetx_props_snapshot`
- `load_prophetx_team_snapshot`
- `load_novig_props_snapshot`
- `load_novig_team_snapshot`
- `load_sharp_book_snapshot`
- `load_parlay_api_odds_snapshot` (league from arg; table `wnba_parlay_api_odds`)

Normalize league the same way each loader already does before the filter call.

- [ ] **Step 5: Run loader tests**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py -v`  
Expected: PASS

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add src/odds/change_filter.py src/odds/load_snapshots.py src/scrapers/tests/odds/test_load_snapshots.py
git commit -m "feat(odds): skip upsert when quote line and price unchanged"
```

---

### Task 4: Board readers — latest per quote identity

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Modify: `backend/tests/test_odds_snapshots_mlb_props.py`
- Create: `backend/tests/test_odds_snapshots_latest_per_quote.py`

**Interfaces:**
- Consumes: `get_quote_spec` / `QUOTE_SPECS` identity cols
- Produces: updated `_latest_snapshot_sql(table, columns, identity_cols)` and team SQL builders using `DISTINCT ON`

- [ ] **Step 1: Write failing tests**

Update `backend/tests/test_odds_snapshots_mlb_props.py` assertions from:

```python
assert f"SELECT MAX(scraped_at) FROM odds.{table}" in sql
```

to:

```python
assert "DISTINCT ON" in sql
assert "scraped_at DESC" in sql
assert f"SELECT MAX(scraped_at) FROM odds.{table}" not in sql
```

Add `backend/tests/test_odds_snapshots_latest_per_quote.py`:

```python
from app.core import odds_snapshots as svc


def test_latest_snapshot_sql_uses_prizepicks_identity():
    sql = svc._latest_snapshot_sql(
        "mlb_prizepicks",
        "player_name, stat_type, line_score, odds_type, scraped_at",
        identity_cols=("league", "player_name", "stat_type", "odds_type"),
    )
    assert "DISTINCT ON (league, player_name, stat_type, odds_type)" in sql
    assert "ORDER BY league, player_name, stat_type, odds_type, scraped_at DESC" in sql
    assert "MAX(scraped_at)" not in sql
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_odds_snapshots_mlb_props.py tests/test_odds_snapshots_latest_per_quote.py -v`  
Expected: FAIL on DISTINCT ON / signature

- [ ] **Step 3: Implement reader SQL**

Replace `_latest_snapshot_sql` in `backend/app/core/odds_snapshots.py`:

```python
from src.odds.quote_specs import get_quote_spec


def _latest_snapshot_sql(
    table: str,
    columns: str,
    *,
    identity_cols: tuple[str, ...] | None = None,
) -> str:
    identity = identity_cols or get_quote_spec(table).identity_cols
    # Drop league from DISTINCT ON list in SELECT projection if callers omit it;
    # still filter WHERE league = :league and include league in DISTINCT/ORDER.
    identity_sql = ", ".join(identity)
    order_sql = f"{identity_sql}, scraped_at DESC"
    return f"""
SELECT DISTINCT ON ({identity_sql}) {columns}
FROM odds.{table}
WHERE league = :league
ORDER BY {order_sql}
"""
```

Update team fetchers (`fetch_latest_pinnacle_team`, `fetch_latest_prophetx_team`, `fetch_latest_novig_team`) to the same `DISTINCT ON` pattern using `get_quote_spec(table).identity_cols`, keeping their extra `AND` filters.

Ensure selected `columns` still include whatever the API needs; if `league` is in identity but not in `columns`, Postgres `DISTINCT ON` still allows it (identity cols need not all appear in select list in PG — actually **they must match leftmost ORDER BY**; SELECT can omit some. In PostgreSQL, DISTINCT ON expressions must match leftmost ORDER BY; selected columns can be a subset/superset. Good.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_odds_snapshots_mlb_props.py tests/test_odds_snapshots_latest_per_quote.py -v`  
Expected: PASS

Also run any other backend tests that assert max-batch SQL:

Run: `cd backend && python -m pytest -k odds_snapshots -v`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add backend/app/core/odds_snapshots.py backend/tests/test_odds_snapshots_mlb_props.py backend/tests/test_odds_snapshots_latest_per_quote.py
git commit -m "fix(odds): read latest quote per identity instead of max scraped_at batch"
```

---

### Task 5: One-time prune script

**Files:**
- Create: `scripts/prune_odds_unchanged_snapshots.py`
- Test: `src/scrapers/tests/odds/test_prune_odds_unchanged.py`

**Interfaces:**
- Consumes: `QUOTE_SPECS`, `values_equal` from `change_filter`
- Produces: CLI `python -m scripts.prune_odds_unchanged_snapshots [--table T] [--apply]`  
  Default dry-run; `--apply` deletes

- [ ] **Step 1: Write failing unit test for keep-set logic**

```python
# src/scrapers/tests/odds/test_prune_odds_unchanged.py
import pandas as pd

from scripts.prune_odds_unchanged_snapshots import rows_to_delete_mask
from src.odds.quote_specs import get_quote_spec


def test_prune_keeps_first_and_real_moves_only():
    spec = get_quote_spec("wnba_prizepicks")
    df = pd.DataFrame(
        [
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 20.5,
                "scraped_at": "t1",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 20.5,
                "scraped_at": "t2",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 21.5,
                "scraped_at": "t3",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 21.5,
                "scraped_at": "t4",
            },
        ]
    )
    delete_mask = rows_to_delete_mask(df, spec)
    # delete t2 and t4 duplicates
    assert list(df.loc[delete_mask, "scraped_at"]) == ["t2", "t4"]
```

If `scripts` is not importable as a package, put pure helpers in `src/odds/prune_unchanged.py` and have the script call them (preferred for clean imports):

- Create: `src/odds/prune_unchanged.py` with `rows_to_delete_mask`
- Create: `scripts/prune_odds_unchanged_snapshots.py` as CLI wrapper

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest src/scrapers/tests/odds/test_prune_odds_unchanged.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement prune helper + CLI**

```python
# src/odds/prune_unchanged.py
from __future__ import annotations

import pandas as pd

from src.odds.change_filter import values_equal
from src.odds.quote_specs import QuoteSpec


def rows_to_delete_mask(df: pd.DataFrame, spec: QuoteSpec) -> pd.Series:
    """True = delete. df must be sorted by identity cols then scraped_at ascending."""
    delete = pd.Series(False, index=df.index)
    prev_key = None
    prev_compare: dict | None = None
    for idx, row in df.iterrows():
        key = tuple(row.get(c) for c in spec.identity_cols)
        compare = {c: row.get(c) for c in spec.compare_cols}
        if key != prev_key:
            prev_key = key
            prev_compare = compare
            continue
        unchanged = all(
            values_equal(compare[c], prev_compare[c]) for c in spec.compare_cols
        )
        if unchanged:
            delete.at[idx] = True
        else:
            prev_compare = compare
    return delete
```

CLI sketch (`scripts/prune_odds_unchanged_snapshots.py`):

```python
"""Dry-run / apply prune of unchanged odds snapshot duplicates.

Usage:
  python scripts/prune_odds_unchanged_snapshots.py
  python scripts/prune_odds_unchanged_snapshots.py --table mlb_pinnacle --apply
"""
from __future__ import annotations

import argparse
# for each table in QUOTE_SPECS (or --table):
#   SELECT identity + compare + scraped_at (+ ctid or full PK for deletes)
#   ORDER BY identity..., scraped_at
#   compute delete mask
#   dry-run: print counts
#   --apply: DELETE using primary/unique key batches
```

Use each table’s conflict/unique key (identity + compare line col + `scraped_at`) for deletes. Batch deletes (e.g. 1000) inside a transaction per table.

- [ ] **Step 4: Run tests**

Run: `pytest src/scrapers/tests/odds/test_prune_odds_unchanged.py -v`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/odds/prune_unchanged.py scripts/prune_odds_unchanged_snapshots.py src/scrapers/tests/odds/test_prune_odds_unchanged.py
git commit -m "feat(odds): add script to prune unchanged historical snapshot rows"
```

---

### Task 6: Docs touch-up

**Files:**
- Modify: `docs/superpowers/specs/2026-08-10-odds-change-only-snapshots-design.md` (Status → Implemented) **only after code lands**
- Optionally note in `backend/README.md` or `src/odds` docstring that boards are latest-per-quote

- [ ] **Step 1:** After Tasks 1–5 pass, set design status to `Implemented` and add a one-line pointer to this plan path.

- [ ] **Step 2: Commit** (only if user asked)

```bash
git add docs/superpowers/specs/2026-08-10-odds-change-only-snapshots-design.md
git commit -m "docs: mark change-only odds snapshots design implemented"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Change-only inserts (line or price) | 2, 3 |
| All scraper odds loaders | 3 |
| No PK/schema change | all |
| Reader latest-per-identity | 4 |
| Throttle keeps MAX(scraped_at) | 3 (no change to throttle helpers) |
| One-time prune + dry-run | 5 |
| Kill switch `ODDS_SKIP_CHANGE_FILTER` | 3 |
| Tests for filter / readers / prune | 1–5 |
| Alt collapse / vanished quotes out of scope | documented; no task |

## Self-review notes

- No TBD placeholders in task steps
- `apply_change_filter` / `filter_unchanged_quotes` / `QuoteSpec` names consistent across tasks
- Existing `mock_upsert` fixture must identity-patch the filter so older loader tests do not require DB
