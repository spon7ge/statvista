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
