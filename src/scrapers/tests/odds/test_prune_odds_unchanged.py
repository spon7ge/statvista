import pandas as pd

from src.odds.prune_unchanged import rows_to_delete_mask
from src.odds.quote_specs import get_quote_spec


def test_prune_keeps_first_and_real_moves_only():
    spec = get_quote_spec("wnba_prizepicks")
    df = pd.DataFrame(
        [
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 20.5,
                "scraped_at": "t1",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 20.5,
                "scraped_at": "t2",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 21.5,
                "scraped_at": "t3",
            },
            {
                "league": "wnba",
                "player_name": "A",
                "stat_type": "Points",
                "odds_type": "standard",
                "line_score": 21.5,
                "scraped_at": "t4",
            },
        ]
    )
    delete_mask = rows_to_delete_mask(df, spec)
    # delete t2 and t4 duplicates
    assert list(df.loc[delete_mask, "scraped_at"]) == ["t2", "t4"]
