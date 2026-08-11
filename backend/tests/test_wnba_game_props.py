from app.domains.wnba.game_props import pick_best_quote, group_game_prop_categories
from app.domains.wnba.schemas_game_props import WnbaGamePropPlayer
from app.domains.betting.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    q = pick_best_quote([("draftkings", 100), ("novig", 100)])
    assert q is not None
    assert q.book == "novig"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_group_game_prop_categories_stable_order():
    players = {
        "assists": [
            WnbaGamePropPlayer(
                player_name="A",
                team_abbrev="MIN",
                headshot_url=None,
                line=5.5,
                over=None,
                under=None,
            )
        ],
        "points": [
            WnbaGamePropPlayer(
                player_name="B",
                team_abbrev="SEA",
                headshot_url=None,
                line=18.5,
                over=None,
                under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["points", "assists"]
    assert cats[0].label == display_stat_label("points")


def test_game_prop_category_order_includes_core():
    assert "points" in GAME_PROP_CATEGORY_ORDER
    assert "rebounds" in GAME_PROP_CATEGORY_ORDER
    assert "assists" in GAME_PROP_CATEGORY_ORDER
    assert GAME_PROP_CATEGORY_ORDER.index("points") < GAME_PROP_CATEGORY_ORDER.index(
        "rebounds"
    )
