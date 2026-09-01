from datetime import datetime, timezone

from app.domains.wnba.schemas_prop_board import (
    WnbaPropBoardBookChip,
    WnbaPropBoardResponse,
    WnbaPropBoardRow,
)


def test_board_response_defaults_empty_rows():
    body = WnbaPropBoardResponse(as_of=datetime.now(timezone.utc))
    dumped = body.model_dump()
    assert dumped["rows"] == []
    assert dumped["warnings"] == []


def test_board_row_requires_side_and_line():
    row = WnbaPropBoardRow(
        player_name="Caitlin Clark",
        headshot_url=None,
        team_abbrev="IND",
        opponent_abbrev="NYL",
        home_away="away",
        stat="points",
        market_label="Over 18.5 Points",
        side="over",
        line=18.5,
        game_id="401810001",
        game_start_at=None,
        books=[WnbaPropBoardBookChip(book="prophetx", american=-115)],
        ip_pct=53,
        opp_def_rank=None,
        opp_def_label=None,
        opp_pace_rank=None,
        opp_pace_label=None,
        hit_l5=80,
        hit_l10=70,
        hit_l15=60,
    )
    assert row.side == "over"
    assert row.books[0].book == "prophetx"
    assert row.dfs == []
    dumped = row.model_dump()
    assert dumped["dfs"] == []
    assert "dfs" in dumped
    assert dumped["game_id"] == "401810001"
    assert dumped["books"][0]["line"] is None
    assert dumped["books"][0]["over_american"] is None
    assert dumped["books"][0]["under_american"] is None
