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
_ODDS_MIGRATIONS = [
    _REPO_ROOT / "db" / "migrations" / name
    for name in (
        "027_odds_mlb_underdogs.sql",
        "028_odds_mlb_prizepicks.sql",
        "029_odds_mlb_prophetx.sql",
        "031_odds_mlb_pinnacle.sql",
        "032_odds_mlb_prophetx_is_main.sql",
        "033_odds_mlb_novig.sql",
        "039_odds_mlb_parlay_api_odds.sql",
    )
]


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
