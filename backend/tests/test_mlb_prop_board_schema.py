from datetime import datetime, timezone

from app.domains.mlb.schemas_prop_board import (
    MlbPropBoardBookChip,
    MlbPropBoardResponse,
    MlbPropBoardRow,
)


def test_board_response_defaults_empty_rows():
    body = MlbPropBoardResponse(as_of=datetime.now(timezone.utc))
    dumped = body.model_dump()
    assert dumped["rows"] == []
    assert dumped["warnings"] == []


def test_board_row_requires_side_and_line():
    row = MlbPropBoardRow(
        player_name="Aaron Judge",
        headshot_url=None,
        team_abbrev="NYY",
        opponent_abbrev="BOS",
        home_away="away",
        stat="hits",
        market_label="Over 1.5 Hits",
        side="over",
        line=1.5,
        game_pk=1,
        game_start_at=None,
        books=[MlbPropBoardBookChip(book="prophetx", american=-115)],
        ip_pct=53,
        opp_def_rank=12,
        opp_def_label="12th BOS",
        opp_pace_rank=4,
        opp_pace_label="4th BOS",
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
