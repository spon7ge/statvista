-- 032_odds_mlb_prophetx_is_main.sql
-- Flag ProphetX favourite/main prop lines vs alts (dynamic per scrape).

ALTER TABLE odds.mlb_prophetx
    ADD COLUMN IF NOT EXISTS is_main BOOLEAN;
