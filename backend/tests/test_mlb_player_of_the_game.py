"""MLB Player of the Game schema attach + mlb_play provider tests.

Working upstream URLs (Task 2; User-Agent: Mozilla/5.0):
- https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/fan/contests.json
- https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/fan/{contestId}.json
- https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/squads.json

Do not use games.json for matching or pog/contest/.../winner.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.domains.mlb.game_detail import (
    _attach_player_of_the_game,
    attach_player_of_the_game,
)
from app.domains.mlb.schemas import MlbGameDetail, MlbGameDetailTeam
from app.domains.mlb.schemas_game_detail import (
    MlbPlayerOfTheGame,
    MlbPlayerOfTheGameStat,
)
from app.providers.mlb_play.player_of_the_game import (
    fetch_player_of_the_game,
    normalize_player_of_the_game,
    read_potg_cache,
    write_potg_cache,
)

FIXTURE = Path(__file__).parent / "fixtures" / "mlb_play_potg_winner.json"
CONTESTS_FIXTURE = (
    Path(__file__).parent / "fixtures" / "mlb_play_potg_games_sample.json"
)


@pytest.fixture
def sample_live_detail(sample_final_detail: MlbGameDetail) -> MlbGameDetail:
    return sample_final_detail.model_copy(
        update={"status": "live", "status_label": "Live"}
    )


@pytest.fixture
def sample_final_detail() -> MlbGameDetail:
    away = MlbGameDetailTeam(
        id="119",
        abbrev="LAD",
        name="Los Angeles Dodgers",
        score=3,
        color="#005A9C",
    )
    home = MlbGameDetailTeam(
        id="147",
        abbrev="NYY",
        name="New York Yankees",
        score=5,
        color="#0C2340",
    )
    return MlbGameDetail(
        mlb_game_pk="776543",
        status="final",
        status_label="Final",
        venue="Yankee Stadium",
        away=away,
        home=home,
        game_date="2026-08-05",
        sources=["mlb_stats_api"],
        fetched_at="2026-08-05T18:00:00+00:00",
    )


def test_attach_player_of_the_game(sample_final_detail):
    potg = MlbPlayerOfTheGame(
        player_id="592450",
        full_name="Aaron Judge",
        last_name="Judge",
        team_abbrev="NYY",
        headshot_url="https://example.test/judge.png",
        stats=[MlbPlayerOfTheGameStat(label=None, value="3-4 · 2 HR · 5 RBI")],
    )
    out = attach_player_of_the_game(sample_final_detail, potg)
    assert out.player_of_the_game is not None
    assert out.player_of_the_game.player_id == "592450"
    assert out.player_of_the_game.source == "mlb_player_of_the_game"


def test_attach_player_of_the_game_none_unchanged(sample_final_detail):
    out = attach_player_of_the_game(sample_final_detail, None)
    assert out.player_of_the_game is None


@pytest.mark.asyncio
async def test_attach_skips_non_final(sample_live_detail):
    with patch(
        "app.domains.mlb.game_detail.fetch_player_of_the_game",
        new_callable=AsyncMock,
    ) as mocked:
        out = await _attach_player_of_the_game(sample_live_detail)
        mocked.assert_not_called()
        assert out.player_of_the_game is None


@pytest.mark.asyncio
async def test_attach_final_merges_winner(sample_final_detail):
    potg = MlbPlayerOfTheGame(
        player_id="1",
        full_name="Test Player",
        last_name="Player",
    )
    with patch(
        "app.domains.mlb.game_detail.fetch_player_of_the_game",
        new_callable=AsyncMock,
        return_value=potg,
    ):
        out = await _attach_player_of_the_game(sample_final_detail)
    assert out.player_of_the_game is not None
    assert out.player_of_the_game.full_name == "Test Player"


def test_normalize_player_of_the_game_from_fixture():
    raw = json.loads(FIXTURE.read_text())
    potg = normalize_player_of_the_game(
        raw, game_pk="823426", team_abbrev="TOR"
    )
    assert potg is not None
    assert potg.player_id == "664770"
    assert potg.full_name == "Nathan Lukes"
    assert potg.last_name == "Lukes"
    assert potg.team_abbrev == "TOR"
    assert potg.source == "mlb_player_of_the_game"
    assert isinstance(potg.stats, list)
    assert potg.stats == [
        MlbPlayerOfTheGameStat(label=None, value="3-6 | HR, 2 RBI, R")
    ]
    assert potg.headshot_url is not None
    assert "664770" in potg.headshot_url
    assert "mlbstatic.com" in potg.headshot_url


def test_write_and_read_potg_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    potg = normalize_player_of_the_game(
        json.loads(FIXTURE.read_text()), game_pk="823426", team_abbrev="TOR"
    )
    assert potg is not None
    write_potg_cache("823426", potg)
    assert (tmp_path / "823426.json").is_file()
    loaded = read_potg_cache("823426")
    assert loaded is not None
    assert loaded.player_id == potg.player_id
    assert loaded.full_name == potg.full_name


@pytest.mark.asyncio
async def test_fetch_uses_cache_hit(tmp_path, monkeypatch):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    potg = normalize_player_of_the_game(
        json.loads(FIXTURE.read_text()), game_pk="1", team_abbrev="TOR"
    )
    assert potg is not None
    write_potg_cache("1", potg)
    client = AsyncMock(spec=httpx.AsyncClient)
    out = await fetch_player_of_the_game(client, game_pk="1")
    assert out is not None
    assert out.player_id == potg.player_id
    client.get.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_soft_fails_on_http_error(monkeypatch, tmp_path):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    client = AsyncMock(spec=httpx.AsyncClient)
    client.get.side_effect = httpx.HTTPError("boom")
    out = await fetch_player_of_the_game(client, game_pk="999999")
    assert out is None
    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_fetch_resolves_contest_player_and_writes_cache(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    contests = json.loads(CONTESTS_FIXTURE.read_text())
    winner = json.loads(FIXTURE.read_text())
    squads = [{"id": 9, "abbreviation": "TOR"}]

    def _response(payload: object) -> httpx.Response:
        return httpx.Response(
            200,
            json=payload,
            request=httpx.Request("GET", "https://example.test/"),
        )

    async def fake_get(url: str, **_kwargs: object) -> httpx.Response:
        if url.endswith("/fan/contests.json"):
            return _response(contests)
        if url.endswith("/fan/3661.json"):
            return _response({"players": [winner]})
        if url.endswith("/squads.json"):
            return _response(squads)
        raise AssertionError(f"unexpected url: {url}")

    client = AsyncMock(spec=httpx.AsyncClient)
    client.get = AsyncMock(side_effect=fake_get)

    out = await fetch_player_of_the_game(client, game_pk="823426")
    assert out is not None
    assert out.player_id == "664770"
    assert out.full_name == "Nathan Lukes"
    assert out.team_abbrev == "TOR"
    assert out.stats[0].value == "3-6 | HR, 2 RBI, R"
    assert (tmp_path / "823426.json").is_file()
    assert client.get.await_count == 3
    # Ensure User-Agent is sent on upstream calls
    for call in client.get.await_args_list:
        headers = call.kwargs.get("headers") or {}
        assert headers.get("User-Agent") == "Mozilla/5.0"
