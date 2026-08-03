-- 027_odds_mlb_underdogs.sql
-- MLB Underdog Fantasy pick'em scraper snapshot table (schema odds).
-- Mirror of odds.wnba_underdogs (019); full snapshot per scrape.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_underdogs (
    league              TEXT        NOT NULL,  -- mlb
    player_name         TEXT        NOT NULL,
    stat_name           TEXT        NOT NULL,
    line_score          NUMERIC     NOT NULL,
    side                TEXT        NOT NULL,  -- over | under
    american_price      INTEGER,
    payout_multiplier   NUMERIC,
    line_updated_at     TIMESTAMPTZ,
    scraped_at          TIMESTAMPTZ NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, player_name, stat_name, side, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_mlb_underdogs_league_scraped_at_idx
    ON odds.mlb_underdogs (league, scraped_at DESC);
