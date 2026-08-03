-- 025_odds_wnba_parlay_api_odds.sql
-- Unified Parlay API prop snapshot table (schema odds).
-- Replaces per-book Parlay upserts for Prop Picks persistence.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_parlay_api_odds (
    sportsbook       TEXT        NOT NULL,
    league           TEXT        NOT NULL,
    player_name      TEXT        NOT NULL,
    market_type      TEXT        NOT NULL,
    stat_category    TEXT,
    side             TEXT        NOT NULL,  -- over | under
    line_score       NUMERIC     NOT NULL,
    american_price   INTEGER     NOT NULL,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        sportsbook, league, player_name, market_type,
        side, line_score, scraped_at
    )
);

CREATE INDEX IF NOT EXISTS odds_wnba_parlay_api_odds_league_scraped_at_idx
    ON odds.wnba_parlay_api_odds (league, scraped_at DESC);
