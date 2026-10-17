from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.domains.nba.schemas_prop_board import (
    NbaPropBoardBookChip,
    NbaPropBoardResponse,
    NbaPropBoardRow,
)


def _row_data() -> dict[str, object]:
    return {
        "player_name": "Jalen Brunson",
        "stat": "points",
        "market_label": "Points",
        "side": "over",
        "line": 25.5,
        "anchor": NbaPropBoardBookChip(
            book="prizepicks",
            line=25.5,
            over_american=-137,
        ),
    }


def test_nba_prop_board_row_requires_anchor():
    data = _row_data()
    data.pop("anchor")

    with pytest.raises(ValidationError):
        NbaPropBoardRow.model_validate(data)


def test_nba_prop_board_dump_has_no_dfs():
    response = NbaPropBoardResponse(
        as_of=datetime(2026, 10, 16, tzinfo=timezone.utc),
        rows=[NbaPropBoardRow.model_validate(_row_data())],
    )

    dumped = response.model_dump()

    assert "dfs" not in dumped["rows"][0]
    assert dumped["rows"][0]["anchor"]["book"] == "prizepicks"
