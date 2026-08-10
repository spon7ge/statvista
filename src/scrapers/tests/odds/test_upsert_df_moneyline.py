"""Unit tests for upsert_df null-conflict handling."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from src.utils import db as db_mod


def test_upsert_df_keeps_moneyline_rows_with_null_points(monkeypatch):
    """Moneyline snapshots use points=NULL; those rows must still upsert."""
    captured: list[pd.DataFrame] = []

    def fake_align(df: pd.DataFrame, *, schema: str, table: str) -> pd.DataFrame:
        return df

    def fake_postgres(table, rows, schema, conflict_cols, cols, batch_size):
        captured.append(pd.DataFrame(rows, columns=cols))

    monkeypatch.setattr(db_mod, "_align_df_to_table", fake_align)
    monkeypatch.setattr(db_mod, "_upsert_df_postgres", fake_postgres)

    scraped = datetime(2026, 8, 10, tzinfo=timezone.utc)
    df = pd.DataFrame(
        [
            {
                "league": "mlb",
                "event_id": 1,
                "market_type": "moneyline",
                "side": "home",
                "points": None,
                "scraped_at": scraped,
                "american_price": -110,
            },
            {
                "league": "mlb",
                "event_id": 1,
                "market_type": "moneyline",
                "side": "away",
                "points": None,
                "scraped_at": scraped,
                "american_price": 100,
            },
            {
                "league": "mlb",
                "event_id": 1,
                "market_type": "run_line",
                "side": "home",
                "points": -1.5,
                "scraped_at": scraped,
                "american_price": -115,
            },
        ]
    )

    db_mod.upsert_df(
        "mlb_prophetx_team",
        df,
        schema="odds",
        conflict_cols=[
            "league",
            "event_id",
            "market_type",
            "side",
            "points",
            "scraped_at",
        ],
        lineage_col=None,
    )

    assert len(captured) == 1
    out = captured[0]
    assert len(out) == 3
    assert set(out["market_type"]) == {"moneyline", "run_line"}
    assert out[out["market_type"] == "moneyline"]["points"].isna().all()
