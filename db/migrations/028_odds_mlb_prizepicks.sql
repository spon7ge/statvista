-- 028_odds_mlb_prizepicks.sql
-- MLB PrizePicks scraper snapshot table (schema odds).
-- Mirror of odds.wnba_prizepicks (019); full snapshot per scrape.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_prizepicks (
    league           TEXT        NOT NULL,  -- mlb
    player_name      TEXT        NOT NULL,
    stat_type        TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    odds_type        TEXT        NOT NULL DEFAULT 'standard',
    line_updated_at  TIMESTAMPTZ,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, player_name, stat_type, odds_type, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_mlb_prizepicks_league_scraped_at_idx
    ON odds.mlb_prizepicks (league, scraped_at DESC);
