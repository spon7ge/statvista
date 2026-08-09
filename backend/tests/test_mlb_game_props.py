from app.domains.mlb.game_props import pick_best_quote, best_side_quote, group_game_prop_categories
from app.domains.mlb.schemas_game_props import MlbGamePropPlayer
from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    # Same american; prophetx before draftkings in BOOK_PRIORITY
    q = pick_best_quote([("draftkings", 100), ("prophetx", 100)])
    assert q is not None
    assert q.book == "prophetx"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_best_side_quote_reads_indexes():
    indexes = {
        "draftkings": {("judge", "home_runs", "over", 0.5): {"american": 250}},
        "fanduel": {("judge", "home_runs", "over", 0.5): {"american": 270}},
        "prophetx": {},
    }
    q = best_side_quote(
        indexes, norm_player="judge", stat_key="home_runs", side="over", line=0.5
    )
    assert q is not None
    assert q.american == 270
    assert q.book == "fanduel"


def test_group_game_prop_categories_stable_order():
    players = {
        "hits": [
            MlbGamePropPlayer(
                player_name="A", team_abbrev="NYY", headshot_url=None,
                line=1.5, over=None, under=None,
            )
        ],
        "home_runs": [
            MlbGamePropPlayer(
                player_name="B", team_abbrev="BOS", headshot_url=None,
                line=0.5, over=None, under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["home_runs", "hits"]
    assert cats[0].label == display_stat_label("home_runs")
