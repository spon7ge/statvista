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
    _find_game,
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


def test_find_game_prefers_complete_duplicate_match():
    incomplete = _slate_game()
    incomplete.away.batters = []

    assert _find_game([incomplete, _slate_game()], "wsh", "sf") == _slate_game()


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
    assert result.away.batters[1].name == "Batter 2"
    assert result.away.batters[1].order == 2
    assert result.away.batters[1].mlbam_id is None
    assert result.away.batters[1].vs_pitcher is None
    assert result.source == "rotowire+statsapi"


@pytest.mark.asyncio
async def test_matchup_zero_at_bats_keeps_vs_pitcher_null():
    slate = MlbLineupsResponse(
        date="2026-08-04",
        games=[_slate_game()],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )

    async def fake_search(client, name):
        return 1

    async def fake_season(client, person_id, season):
        return {}

    async def fake_vs(client, batter_id, pitcher_id):
        return {"ab": 0, "h": 0, "hr": 0, "avg": ".000"}

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
        result = await get_mlb_lineup_matchup("2026-08-04", "WSH", "SF")

    assert result.away is not None
    assert result.away.batters[0].vs_pitcher is None


@pytest.mark.asyncio
async def test_matchup_cache_is_case_insensitive_and_skips_stats_helpers():
    slate = MlbLineupsResponse(
        date="2026-08-04",
        games=[_slate_game()],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )

    with (
        patch(
            "app.services.mlb_lineup_matchup.get_mlb_lineups",
            AsyncMock(return_value=slate),
        ) as mock_lineups,
        patch(
            "app.services.mlb_lineup_matchup.search_person_id",
            AsyncMock(return_value=1),
        ) as mock_search,
        patch(
            "app.services.mlb_lineup_matchup.fetch_season_pitching",
            AsyncMock(return_value={}),
        ) as mock_season,
        patch(
            "app.services.mlb_lineup_matchup.fetch_vs_pitcher_total",
            AsyncMock(return_value=None),
        ) as mock_vs,
        patch("app.services.mlb_lineup_matchup.httpx.AsyncClient") as client_cls,
    ):
        client_cls.return_value.__aenter__.return_value = object()
        first = await get_mlb_lineup_matchup("2026-08-04", "wsh", "sf")
        first_counts = (
            mock_search.await_count,
            mock_season.await_count,
            mock_vs.await_count,
        )
        second = await get_mlb_lineup_matchup("2026-08-04", "WSH", "SF")

    assert second is first
    assert mock_lineups.await_count == 1
    assert (
        mock_search.await_count,
        mock_season.await_count,
        mock_vs.await_count,
    ) == first_counts


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
