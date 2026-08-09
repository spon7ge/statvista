from __future__ import annotations

import pytest

from app.domains.mlb.game_detail import attach_player_of_the_game
from app.domains.mlb.schemas import MlbGameDetail, MlbGameDetailTeam
from app.domains.mlb.schemas_game_detail import (
    MlbPlayerOfTheGame,
    MlbPlayerOfTheGameStat,
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
