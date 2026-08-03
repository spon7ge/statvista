-- 024_odds_wnba_pinnacle_team.sql
-- Selenium Pinnacle team / game markets (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_pinnacle_team (
    league           TEXT        NOT NULL,
    matchup_id       BIGINT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,
    period           INTEGER     NOT NULL DEFAULT 0,
    is_alternate     BOOLEAN     NOT NULL DEFAULT FALSE,
    side             TEXT        NOT NULL,
    team             TEXT,
    points           NUMERIC,
    american_price   INTEGER     NOT NULL,
    decimal_price    NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_snapshot_uidx
    ON odds.wnba_pinnacle_team (
        league, away_team, home_team, market_type, period,
        is_alternate, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_league_scraped_at_idx
    ON odds.wnba_pinnacle_team (league, scraped_at DESC);
