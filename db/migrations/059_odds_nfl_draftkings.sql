-- 059_odds_nfl_draftkings.sql
-- Sharp DraftKings NFL prop snapshot table (schema odds).
-- Mirror of odds.nba_draftkings (054); full snapshot per persist.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.nfl_draftkings (
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

CREATE INDEX IF NOT EXISTS odds_nfl_draftkings_league_scraped_at_idx
    ON odds.nfl_draftkings (league, scraped_at DESC);
