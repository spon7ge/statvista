-- 054_odds_nba_draftkings.sql
-- Sharp DraftKings NBA prop snapshot table (schema odds).
-- Full snapshot per persist; scraped_at in PK for line-move analysis.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.nba_draftkings (
    league           TEXT        NOT NULL,
    player_name      TEXT        NOT NULL,
    market_type      TEXT        NOT NULL,
    stat_category    TEXT,
    side             TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    american_price   INTEGER     NOT NULL,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, player_name, market_type, side, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_nba_draftkings_league_scraped_at_idx
    ON odds.nba_draftkings (league, scraped_at DESC);
