import pytest
from unittest.mock import AsyncMock, patch

from app.schemas.mlb_lineups import (
    MlbLineupBatter,
    MlbLineupGame,
    MlbLineupPitcher,
    MlbLineupSide,
    MlbLineupsResponse,
)
from app.services.mlb_lineup_matchup import (
    clear_mlb_lineup_matchup_cache,
    get_mlb_lineup_matchup,
)


def _slate_game() -> MlbLineupGame:
    batters = [
        MlbLineupBatter(order=i, position="RF", name=f"Batter {i}", hand="R")
        for i in range(1, 10)
    ]
    return MlbLineupGame(
        away_abbrev="WSH",
        home_abbrev="SF",
        status="expected",
        away=MlbLineupSide(
            pitcher=MlbLineupPitcher(name="Zack Littell", hand="R"),
            batters=batters,
        ),
        home=MlbLineupSide(
            pitcher=MlbLineupPitcher(name="Jesus Luzardo", hand="L"),
            batters=batters,
        ),
    )


@pytest.fixture(autouse=True)
def _clear():
    clear_mlb_lineup_matchup_cache()
    yield
    clear_mlb_lineup_matchup_cache()


@pytest.mark.asyncio
async def test_matchup_enriches_pitcher_and_bvp():
    slate = MlbLineupsResponse(
        date="2026-08-04",
        games=[_slate_game()],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )

    async def fake_search(client, name):
        return {
            "Zack Littell": 641793,
            "Jesus Luzardo": 666200,
            "Batter 1": 695578,
        }.get(name)

    async def fake_season(client, person_id, season):
        return {
            "wins": 7,
            "losses": 8,
            "era": "4.97",
            "innings_pitched": "112.1",
            "strikeouts": 70,
            "whip": "1.34",
        }

    async def fake_vs(client, batter_id, pitcher_id):
        if batter_id == 695578 and pitcher_id == 666200:
            return {"ab": 10, "h": 3, "hr": 0, "avg": ".300"}
        return None

    with (
        patch(
            "app.services.mlb_lineup_matchup.get_mlb_lineups",
            AsyncMock(return_value=slate),
        ),
        patch(
            "app.services.mlb_lineup_matchup.search_person_id",
            side_effect=fake_search,
        ),
        patch(
            "app.services.mlb_lineup_matchup.fetch_season_pitching",
            side_effect=fake_season,
        ),
        patch(
            "app.services.mlb_lineup_matchup.fetch_vs_pitcher_total",
            side_effect=fake_vs,
        ),
        patch("app.services.mlb_lineup_matchup.httpx.AsyncClient") as client_cls,
    ):
        client_cls.return_value.__aenter__.return_value = object()
        result = await get_mlb_lineup_matchup("2026-08-04", "wsh", "sf")

    assert result.away is not None
    assert result.away.pitcher.mlbam_id == 641793
    assert result.away.pitcher.whip == "1.34"
    assert result.away.batters[0].vs_pitcher is not None
    assert result.away.batters[0].vs_pitcher.ab == 10
    assert result.source == "rotowire+statsapi"


@pytest.mark.asyncio
async def test_matchup_no_game_returns_null_sides():
    empty = MlbLineupsResponse(
        date="2026-08-04",
        games=[],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )
    with patch(
        "app.services.mlb_lineup_matchup.get_mlb_lineups",
        AsyncMock(return_value=empty),
    ):
        result = await get_mlb_lineup_matchup("2026-08-04", "WSH", "SF")
    assert result.away is None
    assert result.home is None
    assert result.away_abbrev == "WSH"
    assert result.home_abbrev == "SF"
