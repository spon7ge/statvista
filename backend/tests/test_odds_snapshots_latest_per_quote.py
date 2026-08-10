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
