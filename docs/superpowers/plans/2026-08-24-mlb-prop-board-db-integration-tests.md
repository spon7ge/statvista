# MLB Prop Board DB Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Testcontainers Postgres suite so `GET /api/mlb/props/board` is tested against real `odds.*` snapshot tables (latest-per-quote, league filter, unique keys, fixed SELECT count) without mocking the DB driver.

**Architecture:** Session-scoped `postgres:15-alpine` container; apply `db/migrations/*odds*.sql`; point `SUPABASE_DB_URL` at the container and `get_engine.cache_clear()`; `TRUNCATE` `odds.*` before each test; `TestClient` hits the real route; `load_enrichment` is stubbed. Production board code does not change.

**Tech Stack:** pytest, FastAPI `TestClient`, Testcontainers Postgres 15, SQLAlchemy/`src.utils.db.get_engine`, existing `odds.*` migrations.

**Spec:** `docs/superpowers/specs/2026-08-24-mlb-prop-board-db-integration-tests-design.md`

## Global Constraints

- Surface is **`GET /api/mlb/props/board` only** — do not add WNBA `/props/today` or persist/upsert tests
- Database is **ephemeral Postgres 15 via Testcontainers** (session-scoped), image `postgres:15-alpine`
- Schema is **odds-only**: apply `db/migrations/*odds*.sql` in filename order
- Isolation: **`TRUNCATE` every table in schema `odds` before each test** (`RESTART IDENTITY CASCADE`); do not hard-code table names
- HTTP: `TestClient` hits the real route; **`load_enrichment` stubbed** (no ESPN / scoreboard / Stats API)
- Writes: **SQL inserts** through the same SQLAlchemy engine; production `maybe_persist_*` is out of scope
- Docker missing: integration tests **skip**; unit tests still run
- Container or migrate failure: integration tests **fail** (do not skip)
- Safety: fixtures always set `SUPABASE_DB_URL` to the container DSN; **never fall back to `.env` / production**
- Do **not** change `GET /api/mlb/props/board` production behavior, snapshot SQL, or the website
- Do **not** replace `backend/tests/test_mlb_prop_board.py`
- Product name in docs: **statvista**
- Tests ship with code; TDD per task
- Brand / docs: follow `md/claude.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/pytest.ini` | Register `integration` marker |
| `backend/requirements-dev.txt` | Add `testcontainers[postgres]` |
| `backend/tests/integration/conftest.py` | Docker skip, Postgres 15 container, odds migrations, `SUPABASE_DB_URL`, `get_engine.cache_clear()`, truncate, enrichment stub, `TestClient` |
| `backend/tests/integration/odds_seed.py` | Insert helpers for PrizePicks, ProphetX, Parlay snapshot rows |
| `backend/tests/integration/test_mlb_prop_board_db.py` | The seven spec cases |
| `backend/README.md` | How to run / skip integration tests |

Do not add a repo-root `conftest.py`. Keep Testcontainers imports inside `backend/tests/integration/` so `pytest backend/tests/test_mlb_prop_board.py` does not start Docker.

Pytest is always run from **repo root** (so `src.*` imports resolve). CI already does `PYTHONPATH=backend python -m pytest backend/tests/ -q`.

---

### Task 1: Harness + empty board + README

**Files:**
- Modify: `backend/pytest.ini`
- Modify: `backend/requirements-dev.txt`
- Create: `backend/tests/integration/conftest.py`
- Create: `backend/tests/integration/test_mlb_prop_board_db.py`
- Modify: `backend/README.md` (append subsection at end of file)

**Interfaces:**
- Consumes: `app.main.app`, `src.utils.db.get_engine`, `db/migrations/*odds*.sql`
- Produces:
  - pytest marker `integration`
  - session fixture `odds_db_url: str` (container SQLAlchemy URL)
  - function fixtures `client: TestClient`, autouse truncate, autouse `load_enrichment` stub
  - `GET /api/mlb/props/board` against empty `odds.*` returns `200` and `rows: []`

- [ ] **Step 1: Write the failing empty-board test**

Create `backend/tests/integration/test_mlb_prop_board_db.py`:

```python
from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


def test_empty_db_returns_no_rows(client):
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    body = res.json()
    assert body["rows"] == []
    assert "parlay_unavailable" in body["warnings"]
```

Do not instantiate `TestClient` at module level. The `client` fixture must come from integration `conftest.py` so this test cannot hit `.env` Supabase.

- [ ] **Step 2: Run test to verify it fails**

Run from repo root:

```bash
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend python -m pytest backend/tests/integration/test_mlb_prop_board_db.py::test_empty_db_returns_no_rows -v
```

Expected: FAIL / ERROR with `fixture 'client' not found` (harness not written yet).

- [ ] **Step 3: Register the marker and add Testcontainers**

`backend/pytest.ini` — keep `asyncio_mode` and add the marker:

```ini
[pytest]
asyncio_mode = auto
markers =
    integration: API tests against ephemeral Postgres (requires Docker)
```

`backend/requirements-dev.txt`:

```
-r requirements.txt
pytest>=9.1.0
pytest-asyncio>=0.24
testcontainers[postgres]>=4.8.0
```

Reinstall:

```bash
pip install -r backend/requirements-dev.txt
```

- [ ] **Step 4: Implement `conftest.py`**

Create `backend/tests/integration/conftest.py` with this exact behavior:

1. If Docker is not reachable, `pytest.skip("Docker is not running")` **before** starting a container.
2. Start `PostgresContainer("postgres:15-alpine")` for the session. If start or migrate raises, **do not skip** — let the test fail.
3. Apply every `db/migrations/*odds*.sql` path in **filename sort order** (repo root is `Path(__file__).resolve().parents[3]`).
4. Set `os.environ["SUPABASE_DB_URL"]` to the container URL only after the container is up. Assert the host is `localhost` or `127.0.0.1`. Then `from src.utils.db import get_engine` and `get_engine.cache_clear()`.
5. Autouse function fixture: `TRUNCATE` all `pg_tables` with `schemaname = 'odds'` (`RESTART IDENTITY CASCADE`). Skip the `TRUNCATE` statement when the list is empty.
6. Autouse: monkeypatch `app.domains.mlb.prop_board.load_enrichment` to an async function that returns `({}, {}, [], set())`.
7. Function fixture `client`: `TestClient(app)` from `app.main`.

```python
from __future__ import annotations

import os
from collections.abc import Generator, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from testcontainers.postgres import PostgresContainer

_REPO_ROOT = Path(__file__).resolve().parents[3]
_ODDS_MIGRATIONS = sorted((_REPO_ROOT / "db" / "migrations").glob("*odds*.sql"))


def _docker_reachable() -> bool:
    try:
        import docker

        docker.from_env().ping()
        return True
    except Exception:
        return False


def _apply_odds_migrations(sqlalchemy_url: str) -> None:
    engine = create_engine(sqlalchemy_url, isolation_level="AUTOCOMMIT")
    raw = engine.raw_connection()
    try:
        raw.autocommit = True
        cur = raw.cursor()
        for path in _ODDS_MIGRATIONS:
            cur.execute(path.read_text())
        cur.close()
    finally:
        raw.close()
        engine.dispose()


@pytest.fixture(scope="session")
def odds_db_url() -> Iterator[str]:
    if not _docker_reachable():
        pytest.skip("Docker is not running")
    with PostgresContainer("postgres:15-alpine") as postgres:
        url = postgres.get_connection_url()
        parsed = make_url(url)
        host = (parsed.host or "").lower()
        if host not in {"localhost", "127.0.0.1"}:
            pytest.fail(f"Refusing non-local test DB host: {host!r}")
        _apply_odds_migrations(url)
        os.environ["SUPABASE_DB_URL"] = url
        from src.utils.db import get_engine

        get_engine.cache_clear()
        yield url
        get_engine.cache_clear()


@pytest.fixture(autouse=True)
def _truncate_odds(odds_db_url: str) -> Generator[None, None, None]:
    from src.utils.db import get_engine

    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'odds'")
        )
        names = [row[0] for row in rows]
        if names:
            qualified = ", ".join(f'odds."{name}"' for name in names)
            conn.execute(text(f"TRUNCATE {qualified} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture(autouse=True)
def _stub_load_enrichment(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_load_enrichment(clusters=None):
        return {}, {}, [], set()

    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        fake_load_enrichment,
    )


@pytest.fixture
def client(odds_db_url: str) -> TestClient:
    from app.main import app

    return TestClient(app)
```

`odds_db_url` is unused in `client` except as a dependency so the container starts before the first request. `_truncate_odds` also depends on `odds_db_url`.

- [ ] **Step 5: Run the empty-board test**

```bash
PYTHONPATH=backend python -m pytest backend/tests/integration/test_mlb_prop_board_db.py::test_empty_db_returns_no_rows -v
```

Expected: `PASSED` when Docker is running. If Docker is not running: `SKIPPED` with `Docker is not running`.

Also confirm unit tests still collect without starting a container:

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_returns_200 -v
```

Expected: `PASSED` (mocked route; no Docker).

- [ ] **Step 6: Document how to run integration tests**

Append to `backend/README.md`:

```markdown
## Integration tests (API ↔ Postgres)

`backend/tests/integration/` starts ephemeral Postgres 15 via Testcontainers and hits `GET /api/mlb/props/board` against real `odds.*` tables. Docker must be running.

From repo root:

```bash
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend python -m pytest backend/tests/integration/ -v
```

Skip them (unit tests only):

```bash
PYTHONPATH=backend python -m pytest backend/tests/ -m "not integration" -q
```

If Docker is not running, integration tests skip; unit tests still pass.
```

- [ ] **Step 7: Commit**

```bash
git add backend/pytest.ini backend/requirements-dev.txt \
  backend/tests/integration/conftest.py \
  backend/tests/integration/test_mlb_prop_board_db.py \
  backend/README.md
git commit -m "Add Postgres Testcontainers harness for MLB board reads."
```

---

### Task 2: Seed helpers + latest-per-quote + league filter

**Files:**
- Create: `backend/tests/integration/odds_seed.py`
- Modify: `backend/tests/integration/test_mlb_prop_board_db.py`

**Interfaces:**
- Consumes: `get_engine()` pointed at the container from Task 1
- Produces:
  - `insert_mlb_prizepicks(*, player_name: str, stat_type: str, line_score: float, scraped_at: datetime, league: str = "mlb", odds_type: str = "standard") -> None`
  - `insert_mlb_prophetx(*, player_name: str, stat_name: str, line_score: float, side: str, american_price: int, scraped_at: datetime, league: str = "mlb", is_main: bool = True) -> None`
  - `insert_mlb_parlay(*, sportsbook: str, player_name: str, market_type: str, side: str, line_score: float, american_price: int, scraped_at: datetime, league: str = "mlb") -> None`
  - Latest `scraped_at` for a PrizePicks identity wins the board line
  - `league='wnba'` rows in `odds.mlb_prizepicks` do not appear on the MLB board

PrizePicks `DISTINCT ON` identity is `league, player_name, stat_type, odds_type` (`src.odds.quote_specs`). `line_score` is **not** in identity. Use `stat_type="Hits"` so `canonical_stat_key_from_pp_mlb` maps to `hits`. `odds_type` must be `standard` or the board drops the row.

- [ ] **Step 1: Write the failing tests**

At the top of `backend/tests/integration/test_mlb_prop_board_db.py` add (helpers live in the same directory; pytest puts that directory on `sys.path`):

```python
from datetime import datetime, timezone

from odds_seed import insert_mlb_prizepicks
```

Then append:

```python
_T0 = datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc)
_T1 = datetime(2026, 8, 21, 12, 0, tzinfo=timezone.utc)


def test_latest_scraped_at_wins_prizepicks_line(client):
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T0,
    )
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=2.5,
        scraped_at=_T1,
    )
    body = client.get("/api/mlb/props/board").json()
    lines = sorted({row["line"] for row in body["rows"]})
    assert lines == [2.5]
    assert {row["player_name"] for row in body["rows"]} == {"Aaron Judge"}
    assert {row["stat"] for row in body["rows"]} == {"hits"}


def test_league_filter_excludes_wnba_rows(client):
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
        league="mlb",
    )
    insert_mlb_prizepicks(
        player_name="A'ja Wilson",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
        league="wnba",
    )
    body = client.get("/api/mlb/props/board").json()
    names = {row["player_name"] for row in body["rows"]}
    assert names == {"Aaron Judge"}
    assert "A'ja Wilson" not in names
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=backend python -m pytest \
  backend/tests/integration/test_mlb_prop_board_db.py::test_latest_scraped_at_wins_prizepicks_line \
  backend/tests/integration/test_mlb_prop_board_db.py::test_league_filter_excludes_wnba_rows -v
```

Expected: FAIL with `ModuleNotFoundError: odds_seed` (helpers not created yet).

- [ ] **Step 3: Implement seed helpers**

Create `backend/tests/integration/odds_seed.py`:

```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import text

from src.utils.db import get_engine


def insert_mlb_prizepicks(
    *,
    player_name: str,
    stat_type: str,
    line_score: float,
    scraped_at: datetime,
    league: str = "mlb",
    odds_type: str = "standard",
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_prizepicks (
                    league, player_name, stat_type, line_score, odds_type, scraped_at
                ) VALUES (
                    :league, :player_name, :stat_type, :line_score, :odds_type, :scraped_at
                )
                """
            ),
            {
                "league": league,
                "player_name": player_name,
                "stat_type": stat_type,
                "line_score": line_score,
                "odds_type": odds_type,
                "scraped_at": scraped_at,
            },
        )


def insert_mlb_prophetx(
    *,
    player_name: str,
    stat_name: str,
    line_score: float,
    side: str,
    american_price: int,
    scraped_at: datetime,
    league: str = "mlb",
    is_main: bool = True,
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_prophetx (
                    league, player_name, stat_name, line_score, side,
                    american_price, scraped_at, is_main
                ) VALUES (
                    :league, :player_name, :stat_name, :line_score, :side,
                    :american_price, :scraped_at, :is_main
                )
                """
            ),
            {
                "league": league,
                "player_name": player_name,
                "stat_name": stat_name,
                "line_score": line_score,
                "side": side,
                "american_price": american_price,
                "scraped_at": scraped_at,
                "is_main": is_main,
            },
        )


def insert_mlb_parlay(
    *,
    sportsbook: str,
    player_name: str,
    market_type: str,
    side: str,
    line_score: float,
    american_price: int,
    scraped_at: datetime,
    league: str = "mlb",
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_parlay_api_odds (
                    sportsbook, league, player_name, market_type, side,
                    line_score, american_price, scraped_at
                ) VALUES (
                    :sportsbook, :league, :player_name, :market_type, :side,
                    :line_score, :american_price, :scraped_at
                )
                """
            ),
            {
                "sportsbook": sportsbook,
                "league": league,
                "player_name": player_name,
                "market_type": market_type,
                "side": side,
                "line_score": line_score,
                "american_price": american_price,
                "scraped_at": scraped_at,
            },
        )
```

Board fetches ProphetX/Novig with `mains_only=True`, so `is_main` defaults to `True`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
PYTHONPATH=backend python -m pytest \
  backend/tests/integration/test_mlb_prop_board_db.py::test_empty_db_returns_no_rows \
  backend/tests/integration/test_mlb_prop_board_db.py::test_latest_scraped_at_wins_prizepicks_line \
  backend/tests/integration/test_mlb_prop_board_db.py::test_league_filter_excludes_wnba_rows -v
```

Expected: three `PASSED`.

PrizePicks-only rows still emit Over and Under (assembler always emits both sides). `lines == [2.5]` is the assertion that matters. `ip_pct` is null (DFS never sets IP); do not assert matchup fields (enrichment is stubbed).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/integration/odds_seed.py \
  backend/tests/integration/test_mlb_prop_board_db.py
git commit -m "Assert MLB board latest-per-quote and league filters on real Postgres."
```

---

### Task 3: Multi-book cluster + DFS extra line

**Files:**
- Modify: `backend/tests/integration/test_mlb_prop_board_db.py`

**Interfaces:**
- Consumes: `insert_mlb_prophetx`, `insert_mlb_parlay`, `insert_mlb_prizepicks` from Task 2
- Produces: HTTP assertions that ProphetX + DraftKings at the same line share chips, and a PrizePicks 2.0 line is a separate cluster with `ip_pct is None`

ProphetX `stat_name` and Parlay `market_type` must map through `canonical_stat_key_from_sharp_mlb`. Use `"Hits"` (normalizes to `hits`). Seed **both** `over` and `under` or `_main_from_snapshot_rows` / Parlay mains will drop the quote. DraftKings rows use `sportsbook="draftkings"` (board iterates that book key).

- [ ] **Step 1: Write the failing tests**

Extend the import in `backend/tests/integration/test_mlb_prop_board_db.py` to:

```python
from odds_seed import insert_mlb_parlay, insert_mlb_prizepicks, insert_mlb_prophetx
```

Append to `backend/tests/integration/test_mlb_prop_board_db.py`:

```python
def _px_two_way(*, player_name: str, line: float, scraped_at) -> None:
    for side, american in (("over", -110), ("under", -110)):
        insert_mlb_prophetx(
            player_name=player_name,
            stat_name="Hits",
            line_score=line,
            side=side,
            american_price=american,
            scraped_at=scraped_at,
        )


def test_prophetx_and_draftkings_share_line_chips(client):
    _px_two_way(player_name="Mookie Betts", line=1.5, scraped_at=_T1)
    for side, american in (("over", -115), ("under", -105)):
        insert_mlb_parlay(
            sportsbook="draftkings",
            player_name="Mookie Betts",
            market_type="Hits",
            side=side,
            line_score=1.5,
            american_price=american,
            scraped_at=_T1,
        )
    body = client.get("/api/mlb/props/board").json()
    rows = body["rows"]
    assert {row["side"] for row in rows} == {"over", "under"}
    assert {row["line"] for row in rows} == {1.5}
    assert {row["stat"] for row in rows} == {"hits"}
    over = next(row for row in rows if row["side"] == "over")
    under = next(row for row in rows if row["side"] == "under")
    assert {chip["book"] for chip in over["books"]} == {"prophetx", "draftkings"}
    assert {chip["book"] for chip in under["books"]} == {"prophetx", "draftkings"}
    over_by_book = {chip["book"]: chip["american"] for chip in over["books"]}
    assert over_by_book["prophetx"] == -110
    assert over_by_book["draftkings"] == -115


def test_prizepicks_extra_line_has_null_ip(client):
    _px_two_way(player_name="Mookie Betts", line=1.5, scraped_at=_T1)
    insert_mlb_prizepicks(
        player_name="Mookie Betts",
        stat_type="Hits",
        line_score=2.0,
        scraped_at=_T1,
    )
    body = client.get("/api/mlb/props/board").json()
    lines = sorted({row["line"] for row in body["rows"]})
    assert lines == [1.5, 2.0]
    dfs = [row for row in body["rows"] if row["line"] == 2.0]
    assert dfs
    assert all(row["ip_pct"] is None for row in dfs)
    assert all(
        any(chip["book"] == "prizepicks" for chip in row["books"]) for row in dfs
    )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=backend python -m pytest \
  backend/tests/integration/test_mlb_prop_board_db.py::test_prophetx_and_draftkings_share_line_chips \
  backend/tests/integration/test_mlb_prop_board_db.py::test_prizepicks_extra_line_has_null_ip -v
```

Expected: FAIL on `ImportError` / `NameError` until the import and `_px_two_way` exist. After Step 1 is fully typed in, re-run: both tests should **PASS** against unchanged production board code. If a test fails, fix **seed data** (both `over`/`under` rows, `is_main=true`, `stat_name="Hits"`). Do not change `prop_board.py`.

- [ ] **Step 3: Run the full integration file**

```bash
PYTHONPATH=backend python -m pytest backend/tests/integration/test_mlb_prop_board_db.py -v
```

Expected: all tests `PASSED` (five so far: empty, latest, league, multi-book, DFS line).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/test_mlb_prop_board_db.py
git commit -m "Cover MLB board multi-book chips and DFS extra lines on Postgres."
```

---

### Task 4: Primary-key violation + SELECT count

**Files:**
- Modify: `backend/tests/integration/test_mlb_prop_board_db.py`

**Interfaces:**
- Consumes: `insert_mlb_prizepicks`, `get_engine()`, `collect_board_quotes`
- Produces:
  - Duplicate `odds.mlb_prizepicks` primary key raises `sqlalchemy.exc.IntegrityError`
  - `collect_board_quotes()` issues the **same** number of `odds.*` `SELECT`s for 1 player as for 3 players (SQLAlchemy `before_cursor_execute` on `get_engine()`)

`odds.mlb_prizepicks` PK is `(league, player_name, stat_type, odds_type, line_score, scraped_at)` (`db/migrations/028_odds_mlb_prizepicks.sql`).

Do not monkeypatch `fetch_latest_*`. Count only statements whose normalized text starts with `select` and contains `odds.`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/test_mlb_prop_board_db.py`:

```python
import pytest
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError

from app.domains.mlb.prop_board import collect_board_quotes
from src.utils.db import get_engine


def test_duplicate_prizepicks_primary_key_raises():
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    with pytest.raises(IntegrityError):
        insert_mlb_prizepicks(
            player_name="Aaron Judge",
            stat_type="Hits",
            line_score=1.5,
            scraped_at=_T1,
        )


def _count_odds_selects(fn):
    engine = get_engine()
    seen: list[str] = []

    def _before(conn, cursor, statement, parameters, context, executemany):
        stmt = " ".join(str(statement).split()).lower()
        if stmt.startswith("select") and "odds." in stmt:
            seen.append(str(statement))

    event.listen(engine, "before_cursor_execute", _before)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", _before)
    return seen


def test_collect_board_quotes_select_count_does_not_scale_with_players():
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    one = _count_odds_selects(collect_board_quotes)

    insert_mlb_prizepicks(
        player_name="Mookie Betts",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    insert_mlb_prizepicks(
        player_name="Shohei Ohtani",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    many = _count_odds_selects(collect_board_quotes)

    assert one
    assert many == one
```

`test_duplicate_prizepicks_primary_key_raises` does not need `client`; it still needs `odds_db_url` via autouse truncate. That fixture is autouse, so the test must live in this package (it does).

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=backend python -m pytest \
  backend/tests/integration/test_mlb_prop_board_db.py::test_duplicate_prizepicks_primary_key_raises \
  backend/tests/integration/test_mlb_prop_board_db.py::test_collect_board_quotes_select_count_does_not_scale_with_players -v
```

Expected: PK test **passes** once written (constraint already exists). Query-count test **passes** if `collect_board_quotes` stays one `SELECT` per snapshot table. If query-count fails because listeners also record `TRUNCATE`/`INSERT`, tighten the filter (`startswith("select")` already excludes those). If it fails because ProphetX retries `is_main`, that retry is independent of player count — `many == one` should still hold. If `one` is empty, the listener is attached to a different engine than `get_engine()`; call `get_engine.cache_clear()` is already done in session setup — use the same `get_engine()` instance.

If `many == one` fails, **do not** change production SQL to silence the test. Fix the counter (engine identity / event target) first.

- [ ] **Step 3: Run the full integration module and unit board tests**

```bash
PYTHONPATH=backend python -m pytest backend/tests/integration/ -v
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py -q
```

Expected: integration all `PASSED` (or skipped without Docker); unit board tests `PASSED`.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/test_mlb_prop_board_db.py
git commit -m "Assert MLB snapshot PK collisions and fixed board SELECT count."
```

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| Testcontainers Postgres 15 session container | Task 1 |
| Odds-only `*odds*.sql` migrations, filename order | Task 1 |
| `SUPABASE_DB_URL` + `get_engine.cache_clear()`, local host guard | Task 1 |
| Truncate all `odds.*` before each test | Task 1 |
| Stub `load_enrichment` | Task 1 |
| `TestClient` `GET /api/mlb/props/board` | Tasks 1–3 |
| Skip if no Docker; fail on container/migrate errors | Task 1 |
| Empty DB → `rows: []`, `parlay_unavailable` allowed | Task 1 |
| Latest-per-quote (`scraped_at`) | Task 2 |
| League filter mlb vs wnba | Task 2 |
| Multi-book cluster chips | Task 3 |
| DFS extra line, `ip_pct` null | Task 3 |
| PK `IntegrityError` on `mlb_prizepicks` | Task 4 |
| SELECT count independent of player count | Task 4 |
| No persist/upsert / WNBA today / silver-gold | Non-goals — no tasks |
| Existing mocked `test_mlb_prop_board.py` unchanged | Task 1 verification |
| `backend/README.md` subsection | Task 1 |
| `testcontainers` on `requirements-dev.txt`; CI command unchanged | Task 1 |
| ProphetX/Novig seeds set `is_main=true` | Task 2–3 helpers |
