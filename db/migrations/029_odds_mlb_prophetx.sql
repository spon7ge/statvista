-- 029_odds_mlb_prophetx.sql
-- MLB ProphetX player prop snapshots (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_prophetx (
    league           TEXT        NOT NULL,
    event_id         BIGINT,
    away_team        TEXT,
    home_team        TEXT,
    start_time       TIMESTAMPTZ,
    player_name      TEXT        NOT NULL,
    stat_name        TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    side             TEXT        NOT NULL,
    american_price   INTEGER,
    stake            NUMERIC,
    market_id        BIGINT,
    sub_type         TEXT,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_mlb_prophetx_snapshot_uidx
    ON odds.mlb_prophetx (
        league, event_id, player_name, stat_name, side, line_score, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_mlb_prophetx_league_scraped_at_idx
    ON odds.mlb_prophetx (league, scraped_at DESC);
