-- 037_odds_wnba_prophetx_team.sql
-- WNBA ProphetX team / game markets (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_prophetx_team (
    league           TEXT        NOT NULL,
    event_id         BIGINT,
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

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_prophetx_team_snapshot_uidx
    ON odds.wnba_prophetx_team (
        league, event_id, market_type, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_prophetx_team_league_scraped_at_idx
    ON odds.wnba_prophetx_team (league, scraped_at DESC);
