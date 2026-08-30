from app.domains.betting.legs_pack import PackablePlay, pack_entries
from app.domains.mlb.schemas_legs import MlbLegsPlay


def _item(
    player_key: str,
    player: str,
    margin: float,
    *,
    game_id: str | None = None,
    market: str = "Hits",
) -> PackablePlay:
    return PackablePlay(
        player_key=player_key,
        play=MlbLegsPlay(
            rank=0,
            player=player,
            team="NYY",
            matchup="NYY @ BOS",
            market=market,
            dfs_line=1.5,
            side="over",
            variant="standard",
            game_id=game_id,
            sharp_anchor="pinnacle",
            fair_prob=0.60,
            break_even=0.56,
            required_margin_pts=4.0,
            margin_pts=margin,
            book_disagreement_pts=1.0,
            payout_multiplier=1.0,
        ),
    )


def test_five_plays_n4_one_card_one_unpacked():
    plays = [
        _item("a", "A", 9.0),
        _item("b", "B", 8.0),
        _item("c", "C", 7.0),
        _item("d", "D", 6.0),
        _item("e", "E", 5.0),
    ]
    entries, unpacked = pack_entries(plays, n=4, format="power")
    assert len(entries) == 1
    assert unpacked == 1
    assert [p.player for p in entries[0].legs] == ["A", "B", "C", "D"]
    assert [p.rank for p in entries[0].legs] == [1, 2, 3, 4]


def test_same_player_key_skipped_second_market():
    plays = [
        _item("judge", "Aaron Judge", 9.0, market="Hits"),
        _item("judge", "Aaron Judge", 8.0, market="Total Bases"),
        _item("soto", "Juan Soto", 7.0),
    ]
    entries, unpacked = pack_entries(plays, n=2, format="power")
    assert len(entries) == 1
    assert unpacked == 1
    assert [p.player for p in entries[0].legs] == ["Aaron Judge", "Juan Soto"]
    assert entries[0].legs[0].market == "Hits"


def test_flex_skips_third_same_game_and_fills_from_others():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
        _item("d", "D", 6.0, game_id="222"),
        _item("e", "E", 5.0, game_id="333"),
        _item("f", "F", 4.0, game_id="444"),
        _item("g", "G", 3.0, game_id="555"),
    ]
    entries, unpacked = pack_entries(plays, n=6, format="flex")
    assert len(entries) == 1
    keys = {p.player for p in entries[0].legs}
    assert "C" not in keys
    assert unpacked == 1
    games = [p.game_id for p in entries[0].legs]
    assert games.count("111") == 2


def test_flex_cannot_fill_six_no_card():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
    ]
    entries, unpacked = pack_entries(plays, n=6, format="flex")
    assert entries == []
    assert unpacked == 3


def test_power_allows_three_same_game():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
    ]
    entries, unpacked = pack_entries(plays, n=3, format="power")
    assert len(entries) == 1
    assert unpacked == 0
    assert [p.game_id for p in entries[0].legs] == ["111", "111", "111"]
