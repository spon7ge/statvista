# NBA API Supabase Upsert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each NBA Parquet write, upsert bronze datasets and the silver player game log into Supabase schema `nba_api`.

**Architecture:** `upsert_df` gains a `postgres_only` flag that refuses the PostgREST fallback. `src/pipeline/nba_api_store.py` maps the six pipeline datasets onto that call. `GameLogs._save` and `build_silver` call it for NBA only, after the Parquet file is on disk. One migration copies the existing raw and silver column lists into `nba_api`.

**Tech Stack:** Python, pandas, pytest, existing `src/utils/db.py` Postgres upsert, SQL migration under `db/migrations/`.

## Global Constraints

- Schema name is `nba_api`.
- Bronze tables are `player_base`, `player_adv`, `team_base`, `team_adv`, `start_positions`.
- Silver table is `player_gamelogs` and includes Basketball-Reference `pos` and RotoWire `team_spread` / `game_total`.
- Columns are typed. A new API field is ignored until a later migration adds it.
- Player conflict key is `game_id`, `player_id`. Team conflict key is `game_id`, `team_id`.
- Every NBA bronze save and every NBA silver build upserts after that step's Parquet write succeeds.
- Missing `SUPABASE_DB_URL`, or a failed direct upsert, fails the command. No Supabase API fallback on this path.
- WNBA does not open a database connection.
- No API, frontend, `raw.*`, or `silver.*` changes. Do not edit `md/system-design.md`.
- Primary keys only. No extra indexes, row-level security, or PostgREST grants.
- Tracking checkpoints stay local. `start_positions` upserts only when that dataset is saved.
- Tests live in `src/pipeline/tests/test_nba_api_store.py`. No live database and no live `nba_api` calls.
- Applying `060_nba_api_gamelogs.sql` in the Supabase SQL editor is a manual step for the operator after the file exists. Do not connect to Supabase from these tasks.

---

### Task 1: Fail closed when `postgres_only=True`

**Files:**
- Modify: `src/utils/db.py` (`upsert_df`, around the signature and the `except` that falls back to PostgREST)
- Test: `src/pipeline/tests/test_nba_api_store.py`

**Interfaces:**
- Consumes: existing `upsert_df(table, df, schema="raw", conflict_cols=None, batch_size=2000, *, lineage_col="fetched_at")`
- Produces: `upsert_df(..., *, lineage_col="fetched_at", postgres_only: bool = False) -> None`. `postgres_only=True` re-raises any exception from the direct Postgres path. The default `False` keeps the PostgREST fallback.

- [ ] **Step 1: Write the failing test**

Create `src/pipeline/tests/test_nba_api_store.py`:

```python
"""NBA pipeline Supabase upsert. No live database and no live nba_api calls."""

from __future__ import annotations

import pandas as pd
import pytest

from src.utils import db as db_mod


def test_postgres_only_reraises_and_skips_rest(monkeypatch):
    def boom(df, *, schema, table):
        raise RuntimeError("SUPABASE_DB_URL is not set")

    rest_calls: list[bool] = []

    monkeypatch.setattr(db_mod, "_align_df_to_table", boom)
    monkeypatch.setattr(
        db_mod,
        "_upsert_df_supabase",
        lambda *args, **kwargs: rest_calls.append(True),
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")

    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1}])

    with pytest.raises(RuntimeError, match="SUPABASE_DB_URL"):
        db_mod.upsert_df(
            "player_base",
            frame,
            schema="nba_api",
            conflict_cols=["game_id", "player_id"],
            postgres_only=True,
        )

    assert rest_calls == []


def test_default_upsert_still_falls_back_to_rest(monkeypatch):
    def boom(df, *, schema, table):
        raise RuntimeError("connection refused")

    rest_calls: list[str] = []

    monkeypatch.setattr(db_mod, "_align_df_to_table", boom)
    monkeypatch.setattr(
        db_mod,
        "_upsert_df_supabase",
        lambda table, records, schema, conflict_cols, batch_size: rest_calls.append(
            schema
        ),
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")

    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1}])
    db_mod.upsert_df(
        "player_base",
        frame,
        schema="nba_api",
        conflict_cols=["game_id", "player_id"],
    )

    assert rest_calls == ["nba_api"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py::test_postgres_only_reraises_and_skips_rest -v`

Expected: FAIL with `TypeError` because `postgres_only` is an unexpected keyword.

- [ ] **Step 3: Write minimal implementation**

In `upsert_df`, add the keyword and re-raise before the fallback. Leave the fallback in place for the default.

```python
def upsert_df(
    table: str,
    df: pd.DataFrame,
    schema: str = "raw",
    conflict_cols: list[str] | None = None,
    batch_size: int = 2000,
    *,
    lineage_col: str | None = "fetched_at",
    postgres_only: bool = False,
) -> None:
```

Add this sentence to the docstring, after the PostgREST bullet:

```python
    - ``postgres_only=True`` requires the direct Postgres path and re-raises
      on failure, including a missing ``SUPABASE_DB_URL``.
```

Replace the start of the `except` block:

```python
    except Exception as exc:
        if postgres_only or not os.environ.get("SUPABASE_URL"):
            raise
        if exc.__class__.__name__ in ("UndefinedColumn", "UndefinedTable", "DataError"):
            raise
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/db.py src/pipeline/tests/test_nba_api_store.py
git commit -m "$(cat <<'EOF'
feat(pipeline): fail closed on postgres-only upserts

EOF
)"
```

---

### Task 2: NBA dataset loader

**Files:**
- Create: `src/pipeline/nba_api_store.py`
- Modify: `src/pipeline/tests/test_nba_api_store.py`

**Interfaces:**
- Consumes: `upsert_df(table, df, schema="nba_api", conflict_cols=..., lineage_col=..., postgres_only=True)` from Task 1.
- Produces:
  - `upsert_nba_dataset(dataset: str, frame: pd.DataFrame) -> None`
  - `upsert_nba_silver(frame: pd.DataFrame) -> None`
  - Unknown `dataset` raises `ValueError`.
  - An empty frame returns without calling `upsert_df`.

- [ ] **Step 1: Write the failing test**

Append to `src/pipeline/tests/test_nba_api_store.py`:

```python
from src.pipeline.nba_api_store import upsert_nba_dataset, upsert_nba_silver


BRONZE_CASES = [
    ("player_base", ["game_id", "player_id"], "fetched_at"),
    ("player_adv", ["game_id", "player_id"], "fetched_at"),
    ("team_base", ["game_id", "team_id"], "fetched_at"),
    ("team_adv", ["game_id", "team_id"], "fetched_at"),
    ("start_positions", ["game_id", "player_id"], "fetched_at"),
]


@pytest.mark.parametrize(
    ("dataset", "conflict_cols", "lineage_col"),
    BRONZE_CASES,
)
def test_upsert_nba_dataset_targets(monkeypatch, dataset, conflict_cols, lineage_col):
    captured: dict[str, object] = {}

    def fake_upsert(table, df, schema="raw", conflict_cols=None, batch_size=2000, *, lineage_col="fetched_at", postgres_only=False):
        captured["table"] = table
        captured["schema"] = schema
        captured["conflict_cols"] = conflict_cols
        captured["lineage_col"] = lineage_col
        captured["postgres_only"] = postgres_only
        captured["rows"] = len(df)

    monkeypatch.setattr("src.pipeline.nba_api_store.upsert_df", fake_upsert)
    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1, "team_id": 10}])

    upsert_nba_dataset(dataset, frame)

    assert captured == {
        "table": dataset,
        "schema": "nba_api",
        "conflict_cols": conflict_cols,
        "lineage_col": lineage_col,
        "postgres_only": True,
        "rows": 1,
    }


def test_upsert_nba_silver_targets_player_gamelogs(monkeypatch):
    captured: dict[str, object] = {}

    def fake_upsert(table, df, schema="raw", conflict_cols=None, batch_size=2000, *, lineage_col="fetched_at", postgres_only=False):
        captured["table"] = table
        captured["schema"] = schema
        captured["conflict_cols"] = conflict_cols
        captured["lineage_col"] = lineage_col
        captured["postgres_only"] = postgres_only

    monkeypatch.setattr("src.pipeline.nba_api_store.upsert_df", fake_upsert)

    upsert_nba_silver(pd.DataFrame([{"game_id": "0022500001", "player_id": 1}]))

    assert captured == {
        "table": "player_gamelogs",
        "schema": "nba_api",
        "conflict_cols": ["game_id", "player_id"],
        "lineage_col": "built_at",
        "postgres_only": True,
    }


def test_unknown_dataset_raises():
    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1}])

    with pytest.raises(ValueError, match="not_a_dataset"):
        upsert_nba_dataset("not_a_dataset", frame)


def test_empty_frame_does_not_call_upsert(monkeypatch):
    def fail_upsert(*args, **kwargs):
        raise AssertionError("upsert_df should not be called")

    monkeypatch.setattr("src.pipeline.nba_api_store.upsert_df", fail_upsert)

    upsert_nba_dataset("player_base", pd.DataFrame())
    upsert_nba_silver(pd.DataFrame())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: FAIL with `ModuleNotFoundError` for `src.pipeline.nba_api_store`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pipeline/nba_api_store.py`:

```python
"""Upsert NBA pipeline frames into schema nba_api."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.utils.db import upsert_df

SCHEMA = "nba_api"


@dataclass(frozen=True)
class _Target:
    table: str
    conflict_cols: tuple[str, ...]
    lineage_col: str


_BRONZE: dict[str, _Target] = {
    "player_base": _Target("player_base", ("game_id", "player_id"), "fetched_at"),
    "player_adv": _Target("player_adv", ("game_id", "player_id"), "fetched_at"),
    "team_base": _Target("team_base", ("game_id", "team_id"), "fetched_at"),
    "team_adv": _Target("team_adv", ("game_id", "team_id"), "fetched_at"),
    "start_positions": _Target(
        "start_positions",
        ("game_id", "player_id"),
        "fetched_at",
    ),
}

_SILVER = _Target("player_gamelogs", ("game_id", "player_id"), "built_at")


def upsert_nba_dataset(dataset: str, frame: pd.DataFrame) -> None:
    target = _BRONZE.get(dataset)
    if target is None:
        known = ", ".join(_BRONZE)
        raise ValueError(
            f"Unknown NBA dataset {dataset!r}. Choose from: {known}"
        )
    _upsert(target, frame)


def upsert_nba_silver(frame: pd.DataFrame) -> None:
    _upsert(_SILVER, frame)


def _upsert(target: _Target, frame: pd.DataFrame) -> None:
    if frame.empty:
        return

    upsert_df(
        target.table,
        frame,
        schema=SCHEMA,
        conflict_cols=list(target.conflict_cols),
        lineage_col=target.lineage_col,
        postgres_only=True,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/nba_api_store.py src/pipeline/tests/test_nba_api_store.py
git commit -m "$(cat <<'EOF'
feat(pipeline): map NBA datasets onto nba_api upserts

EOF
)"
```

---

### Task 3: Migration `060_nba_api_gamelogs.sql`

**Files:**
- Create: `db/migrations/060_nba_api_gamelogs.sql`
- Modify: `src/pipeline/tests/test_nba_api_store.py`

**Interfaces:**
- Consumes: column lists in `db/migrations/001_raw_gamelogs.sql` and `db/migrations/003_silver_gamelogs.sql`.
- Produces: schema `nba_api` and the six tables. Silver `minutes` is `NUMERIC`. Tracking `minutes` on `start_positions` stays `TEXT`. No `CREATE INDEX`.

- [ ] **Step 1: Write the failing test**

Append to `src/pipeline/tests/test_nba_api_store.py`:

```python
from pathlib import Path


MIGRATION = Path("db/migrations/060_nba_api_gamelogs.sql")

TABLES = (
    "player_base",
    "player_adv",
    "team_base",
    "team_adv",
    "start_positions",
    "player_gamelogs",
)


def test_nba_api_migration_creates_six_tables():
    sql = MIGRATION.read_text()

    assert "CREATE SCHEMA IF NOT EXISTS nba_api;" in sql
    for table in TABLES:
        assert f"CREATE TABLE IF NOT EXISTS nba_api.{table} (" in sql

    assert sql.count("PRIMARY KEY (game_id, player_id)") == 4
    assert sql.count("PRIMARY KEY (game_id, team_id)") == 2
    assert "CREATE INDEX" not in sql
    assert "CREATE TABLE IF NOT EXISTS raw." not in sql
    assert "CREATE TABLE IF NOT EXISTS silver." not in sql


def test_nba_api_migration_column_types():
    sql = MIGRATION.read_text()
    start = sql.split("CREATE TABLE IF NOT EXISTS nba_api.start_positions (", 1)[1]
    start_body, _, rest = start.partition("CREATE TABLE IF NOT EXISTS nba_api.player_gamelogs (")
    silver_body = rest

    assert "position" in start_body
    assert "speed" in start_body
    assert "distance" in start_body
    assert "minutes" in start_body
    assert "NUMERIC" not in start_body.split("minutes", 1)[1].split(",", 1)[0]

    minutes_tail = silver_body.split("minutes", 1)[1].split(",", 1)[0]
    assert "NUMERIC" in minutes_tail
    for column in ("pos", "team_spread", "game_total", "start_position", "built_at", "season_type"):
        assert column in silver_body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py::test_nba_api_migration_creates_six_tables -v`

Expected: FAIL with `FileNotFoundError`.

- [ ] **Step 3: Generate the migration**

Run this from the repo root. It copies the five bronze `CREATE TABLE` blocks from `001` and the silver `CREATE TABLE` block from `003`, renames them into `nba_api`, changes only the silver `minutes` column to `NUMERIC`, and drops the silver indexes.

```python
python - <<'PY'
import re
from pathlib import Path

root = Path(".")
raw = (root / "db/migrations/001_raw_gamelogs.sql").read_text()
silver = (root / "db/migrations/003_silver_gamelogs.sql").read_text()

def extract_create(sql: str, table: str) -> str:
    pattern = rf"CREATE TABLE IF NOT EXISTS {re.escape(table)} \([\s\S]*?\n\);"
    match = re.search(pattern, sql)
    if match is None:
        raise SystemExit(f"missing {table}")
    return match.group(0)

renames = {
    "raw.nba_player_base": "nba_api.player_base",
    "raw.nba_player_adv": "nba_api.player_adv",
    "raw.nba_team_base": "nba_api.team_base",
    "raw.nba_team_adv": "nba_api.team_adv",
    "raw.nba_player_tracking": "nba_api.start_positions",
}
blocks = []
for source, target in renames.items():
    block = extract_create(raw, source)
    blocks.append(
        block.replace(
            f"CREATE TABLE IF NOT EXISTS {source}",
            f"CREATE TABLE IF NOT EXISTS {target}",
        )
    )

silver_block = extract_create(silver, "silver.nba_player_gamelogs")
silver_block = silver_block.replace(
    "CREATE TABLE IF NOT EXISTS silver.nba_player_gamelogs",
    "CREATE TABLE IF NOT EXISTS nba_api.player_gamelogs",
)
old_minutes = "    minutes                              TEXT,"
new_minutes = "    minutes                              NUMERIC,"
if old_minutes not in silver_block:
    raise SystemExit("silver minutes column not found")
silver_block = silver_block.replace(old_minutes, new_minutes, 1)
blocks.append(silver_block)

header = """-- NBA game-log tables for the pipeline upsert.
-- Bronze columns copied from db/migrations/001_raw_gamelogs.sql.
-- Silver columns copied from db/migrations/003_silver_gamelogs.sql
-- with minutes NUMERIC.
-- Apply in the Supabase SQL editor before the first NBA pipeline upsert.

CREATE SCHEMA IF NOT EXISTS nba_api;

"""
path = root / "db/migrations/060_nba_api_gamelogs.sql"
path.write_text(header + "\n\n".join(blocks) + "\n")
print(path)
PY
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: PASS. Confirm `start_positions` still has `minutes TEXT` and `player_gamelogs` has `minutes NUMERIC` by the new test.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/060_nba_api_gamelogs.sql src/pipeline/tests/test_nba_api_store.py
git commit -m "$(cat <<'EOF'
feat(pipeline): add nba_api bronze and silver game-log tables

EOF
)"
```

---

### Task 4: Upsert bronze saves for NBA

**Files:**
- Modify: `src/pipeline/bronze/fetch.py` (`GameLogs._save`, and the import block at the top)
- Modify: `src/pipeline/tests/test_nba_api_store.py`

**Interfaces:**
- Consumes: `upsert_nba_dataset(dataset: str, frame: pd.DataFrame) -> None` from Task 2.
- Produces: NBA `GameLogs._save` writes Parquet, then calls `upsert_nba_dataset`. WNBA `GameLogs._save` writes Parquet and does not call it. A raised upsert leaves the Parquet file in place. `ParquetStore.write_checkpoint` stays unchanged.

- [ ] **Step 1: Write the failing test**

Append to `src/pipeline/tests/test_nba_api_store.py`:

```python
from src.pipeline.bronze.fetch import GameLogs


def test_nba_save_writes_parquet_then_upserts(tmp_path, monkeypatch):
    calls: list[str] = []

    monkeypatch.setattr(
        "src.pipeline.bronze.fetch.upsert_nba_dataset",
        lambda dataset, frame: calls.append(dataset),
    )
    logs = GameLogs("2025-26", league="nba", output_dir=tmp_path)
    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1}])

    logs._save("player_base", frame)

    assert (tmp_path / "nba_player_base.parquet").exists()
    assert calls == ["player_base"]


def test_nba_save_keeps_parquet_when_upsert_raises(tmp_path, monkeypatch):
    def boom(dataset, frame):
        raise RuntimeError("db down")

    monkeypatch.setattr("src.pipeline.bronze.fetch.upsert_nba_dataset", boom)
    logs = GameLogs("2025-26", league="nba", output_dir=tmp_path)
    frame = pd.DataFrame([{"game_id": "0022500001", "player_id": 1}])

    with pytest.raises(RuntimeError, match="db down"):
        logs._save("player_base", frame)

    assert (tmp_path / "nba_player_base.parquet").exists()


def test_wnba_save_skips_upsert(tmp_path, monkeypatch):
    def boom(dataset, frame):
        raise AssertionError("WNBA must not upsert")

    monkeypatch.setattr("src.pipeline.bronze.fetch.upsert_nba_dataset", boom)
    logs = GameLogs("2025", league="wnba", output_dir=tmp_path)
    frame = pd.DataFrame([{"game_id": "1022500001", "player_id": 1}])

    logs._save("player_base", frame)

    assert (tmp_path / "wnba_player_base.parquet").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py::test_nba_save_writes_parquet_then_upserts -v`

Expected: FAIL because `calls` is empty. The Parquet file may already exist.

- [ ] **Step 3: Write minimal implementation**

Add this import with the other imports in `src/pipeline/bronze/fetch.py`:

```python
from src.pipeline.nba_api_store import upsert_nba_dataset
```

At the end of `GameLogs._save`, after the existing `logger.info` call:

```python
        if self.league == "nba":
            upsert_nba_dataset(dataset, frame)
```

Do not call `upsert_nba_dataset` from `ParquetStore.write_checkpoint` or from the tracking batch loop.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/bronze/fetch.py src/pipeline/tests/test_nba_api_store.py
git commit -m "$(cat <<'EOF'
feat(pipeline): upsert NBA bronze game logs after Parquet writes

EOF
)"
```

---

### Task 5: Upsert silver builds for NBA

**Files:**
- Modify: `src/pipeline/silver/build.py` (`build_silver`, and the import block at the top)
- Modify: `src/pipeline/tests/test_nba_api_store.py`

**Interfaces:**
- Consumes: `upsert_nba_silver(frame: pd.DataFrame) -> None` from Task 2. `build_silver` already returns the silver frame after writing Parquet.
- Produces: NBA `build_silver` writes Parquet, then calls `upsert_nba_silver` with that frame. WNBA `build_silver` writes Parquet and does not call it. A raised upsert leaves the Parquet file in place. `fetch_and_build_silver` needs no separate call: it already calls `GameLogs.fetch` and `build_silver`.

- [ ] **Step 1: Write the failing test**

Append to `src/pipeline/tests/test_nba_api_store.py`:

```python
from src.pipeline.silver.build import build_silver


def _two_team_logs() -> dict[str, pd.DataFrame]:
    return {
        "player_base": pd.DataFrame(
            [
                {"game_id": "0022500001", "player_id": 1, "team_id": 10, "min": 30},
                {"game_id": "0022500001", "player_id": 2, "team_id": 20, "min": 28},
            ]
        ),
        "team_base": pd.DataFrame(
            [
                {"game_id": "0022500001", "team_id": 10, "min": 240},
                {"game_id": "0022500001", "team_id": 20, "min": 240},
            ]
        ),
    }


def test_nba_build_silver_writes_parquet_then_upserts(tmp_path, monkeypatch):
    calls: list[int] = []

    monkeypatch.setattr(
        "src.pipeline.silver.build.upsert_nba_silver",
        lambda frame: calls.append(len(frame)),
    )

    build_silver(
        "2025-26",
        league="nba",
        raw_dir=tmp_path / "raw",
        silver_dir=tmp_path / "silver",
        positions_dir=tmp_path / "positions",
        rotowire_dir=tmp_path / "rotowire",
        raw_frames=_two_team_logs(),
    )

    parquet = (
        tmp_path / "silver" / "nba" / "2025-26" / "regular_season" / "player_gamelogs.parquet"
    )
    assert parquet.exists()
    assert calls == [2]


def test_nba_build_silver_keeps_parquet_when_upsert_raises(tmp_path, monkeypatch):
    def boom(frame):
        raise RuntimeError("db down")

    monkeypatch.setattr("src.pipeline.silver.build.upsert_nba_silver", boom)

    with pytest.raises(RuntimeError, match="db down"):
        build_silver(
            "2025-26",
            league="nba",
            raw_dir=tmp_path / "raw",
            silver_dir=tmp_path / "silver",
            positions_dir=tmp_path / "positions",
            rotowire_dir=tmp_path / "rotowire",
            raw_frames=_two_team_logs(),
        )

    parquet = (
        tmp_path / "silver" / "nba" / "2025-26" / "regular_season" / "player_gamelogs.parquet"
    )
    assert parquet.exists()


def test_wnba_build_silver_skips_upsert(tmp_path, monkeypatch):
    def boom(frame):
        raise AssertionError("WNBA must not upsert")

    monkeypatch.setattr("src.pipeline.silver.build.upsert_nba_silver", boom)

    build_silver(
        "2025",
        league="wnba",
        raw_dir=tmp_path / "raw",
        silver_dir=tmp_path / "silver",
        positions_dir=tmp_path / "positions",
        rotowire_dir=tmp_path / "rotowire",
        raw_frames=_two_team_logs(),
    )

    parquet = (
        tmp_path / "silver" / "wnba" / "2025" / "regular_season" / "player_gamelogs.parquet"
    )
    assert parquet.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py::test_nba_build_silver_writes_parquet_then_upserts -v`

Expected: FAIL because `calls` is empty. The Parquet file may already exist.

- [ ] **Step 3: Write minimal implementation**

Add this import with the other imports in `src/pipeline/silver/build.py`:

```python
from src.pipeline.nba_api_store import upsert_nba_silver
```

In `build_silver`, after the existing `logger.info` that reports the saved silver path and before `return silver`:

```python
    if league == "nba":
        upsert_nba_silver(silver)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest src/pipeline/tests/test_nba_api_store.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/silver/build.py src/pipeline/tests/test_nba_api_store.py
git commit -m "$(cat <<'EOF'
feat(pipeline): upsert NBA silver game logs after Parquet writes

EOF
)"
```

---

## Spec coverage

- Schema, six tables, keys, lineage columns: Tasks 2 and 3.
- Typed columns copied from `001` and `003`, silver `minutes NUMERIC`, no indexes: Task 3.
- NBA upsert after Parquet, WNBA skipped, exception leaves Parquet: Tasks 4 and 5.
- `postgres_only` refuses the API fallback: Task 1.
- Empty frame skips `upsert_df`, unknown dataset raises: Task 2.
- Checkpoints stay local: Task 4 does not hook `write_checkpoint`.
- `--fetch` covers both layers because it calls `GameLogs.fetch` and `build_silver`. No extra call.
- API, frontend, `raw`, `silver`, and `md/system-design.md` are untouched.
