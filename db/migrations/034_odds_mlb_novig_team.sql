-- 034_odds_mlb_novig_team.sql
-- MLB Novig team / game markets (schema odds).
-- event_id is a Novig UUID (TEXT).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_novig_team (
    league           TEXT        NOT NULL,
    event_id         TEXT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,
    side             TEXT        NOT NULL,
    team             TEXT,
    points           NUMERIC,
    american_price   INTEGER     NOT NULL,
    stake            NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_mlb_novig_team_snapshot_uidx
    ON odds.mlb_novig_team (
        league, event_id, market_type, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_mlb_novig_team_league_scraped_at_idx
    ON odds.mlb_novig_team (league, scraped_at DESC);
