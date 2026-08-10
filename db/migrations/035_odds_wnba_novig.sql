-- 035_odds_wnba_novig.sql
-- WNBA Novig player prop snapshots (schema odds).
-- event_id / market_id are UUIDs from Novig GraphQL (TEXT, not BIGINT).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_novig (
    league           TEXT        NOT NULL,
    event_id         TEXT,
    away_team        TEXT,
    home_team        TEXT,
    start_time       TIMESTAMPTZ,
    player_name      TEXT        NOT NULL,
    stat_name        TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    side             TEXT        NOT NULL,
    american_price   INTEGER,
    stake            NUMERIC,
    market_id        TEXT,
    sub_type         TEXT,
    is_main          BOOLEAN,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_novig_snapshot_uidx
    ON odds.wnba_novig (
        league, event_id, player_name, stat_name, side, line_score, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_novig_league_scraped_at_idx
    ON odds.wnba_novig (league, scraped_at DESC);
