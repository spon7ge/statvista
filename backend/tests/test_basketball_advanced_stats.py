"""Season-log advanced averages for NBA and WNBA preview surfaces."""

from unittest.mock import AsyncMock, patch

import pytest

from app.domains.betting.basketball_advanced_stats import (
    canonical_nba_abbrev,
    player_advanced_index,
    team_advanced_index,
)
from app.domains.betting.season_log_cache import read_cached_logs


def _player_game(**overrides: object) -> dict:
    row = {
        "PLAYER_NAME": "Alpha Guard",
        "SEASON_TYPE": "Regular Season",
        "POSS": 40,
        "USG_PCT": 0.2,
        "EFG_PCT": 0.5,
        "TS_PCT": 0.6,
        "AST_PCT": 0.1,
        "AST_TO": 1.0,
        "OREB_PCT": 0.05,
        "DREB_PCT": 0.1,
        "REB_PCT": 0.08,
        "TM_TOV_PCT": 10.0,
        "OFF_RATING": 110.0,
        "DEF_RATING": 100.0,
        "NET_RATING": 10.0,
        "PIE": 0.15,
    }
    row.update(overrides)
    return row


def test_player_advanced_index_weights_by_possessions_and_drops_preseason():
    rows = [
        _player_game(),
        _player_game(
            POSS=60,
            USG_PCT=0.3,
            EFG_PCT=0.4,
            TS_PCT=0.5,
            AST_PCT=0.2,
            AST_TO=2.0,
            OREB_PCT=0.01,
            DREB_PCT=0.2,
            REB_PCT=0.12,
            TM_TOV_PCT=5.0,
            OFF_RATING=120.0,
            DEF_RATING=90.0,
            NET_RATING=30.0,
            PIE=0.2,
        ),
        _player_game(
            SEASON_TYPE="Pre Season",
            POSS=100,
            USG_PCT=0.9,
            EFG_PCT=0.1,
            TS_PCT=0.1,
        ),
    ]

    stats = player_advanced_index(rows)["alpha guard"]

    assert stats == {
        "usg_pct": "26.0",
        "efg_pct": "44.0",
        "ts_pct": "54.0",
        "ast_pct": "16.0",
        "ast_to": "1.6",
        "oreb_pct": "2.6",
        "dreb_pct": "16.0",
        "reb_pct": "10.4",
        "tov_pct": "7.0",
        "off_rtg": "116.0",
        "def_rtg": "94.0",
        "net_rtg": "22.0",
        "pie": "18.0",
    }


def test_player_advanced_index_uses_preseason_when_that_is_all_the_cache_has():
    stats = player_advanced_index(
        [_player_game(SEASON_TYPE="Pre Season", POSS=10, USG_PCT=0.2)]
    )["alpha guard"]

    assert stats["usg_pct"] == "20.0"


def test_player_advanced_index_scales_turnover_fractions_and_skips_bad_rows():
    stats = player_advanced_index(
        [
            _player_game(TM_TOV_PCT=0.175, POSS=10),
            "not-a-row",
            {"SEASON_TYPE": "Regular Season"},
        ]
    )["alpha guard"]

    assert stats["tov_pct"] == "17.5"


def test_team_advanced_index_ranks_and_canonicalizes_abbreviations():
    def row(abbrev: str, **overrides: object) -> dict:
        base = {
            "TEAM_ABBREVIATION": abbrev,
            "SEASON_TYPE": "Regular Season",
            "POSS": 100,
            "EFG_PCT": 0.5,
            "TS_PCT": 0.55,
            "AST_PCT": 0.6,
            "AST_TO": 1.5,
            "OREB_PCT": 0.25,
            "DREB_PCT": 0.7,
            "REB_PCT": 0.5,
            "TM_TOV_PCT": 0.2,
            "OFF_RATING": 110.0,
            "DEF_RATING": 110.0,
            "NET_RATING": 0.0,
            "PACE": 100.0,
            "PIE": 0.5,
        }
        base.update(overrides)
        return base

    index = team_advanced_index(
        [
            row("PHX"),
            row(
                "NYL",
                EFG_PCT=0.6,
                TS_PCT=0.62,
                DEF_RATING=100.0,
                TM_TOV_PCT=0.1,
                NET_RATING=8.0,
                PACE=98.0,
                PIE=0.55,
            ),
        ],
        canonicalize=lambda abbrev: {"PHX": "PHO"}.get(abbrev, abbrev),
    )

    phoenix = index["PHO"]
    liberty = index["NYL"]
    assert phoenix["efg_pct"] == "50.0"
    assert phoenix["efg_pct_rank"] == 2
    assert liberty["efg_pct_rank"] == 1
    assert liberty["ts_pct"] == "62.0"
    assert liberty["def_rtg_rank"] == 1
    assert phoenix["def_rtg_rank"] == 2
    assert liberty["tov_pct"] == "10.0"
    assert liberty["tov_pct_rank"] == 1
    assert phoenix["tov_pct_rank"] == 2
    assert liberty["pace"] == "98.0"
    assert "usg_pct" not in liberty


def test_canonical_nba_abbrev_matches_stats_nba_tricodes():
    rows = [
        {
            "TEAM_ABBREVIATION": "GSW",
            "SEASON_TYPE": "Regular Season",
            "POSS": 80,
            "EFG_PCT": 0.54,
            "TS_PCT": 0.58,
        }
    ]
    index = team_advanced_index(rows, canonicalize=canonical_nba_abbrev)
    assert index["GSW"]["efg_pct"] == "54.0"
    assert canonical_nba_abbrev("gs") == "GSW"
    assert canonical_nba_abbrev("NY") == "NYK"
    assert canonical_nba_abbrev("UTAH") == "UTA"


def test_read_cached_logs_does_not_refresh(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("preview must not refresh season logs")

    monkeypatch.setattr(
        "app.domains.betting.season_log_cache.fetch_logs_frame",
        boom,
    )
    logs = read_cached_logs("nba")
    assert isinstance(logs.get("player_adv"), list)
    assert isinstance(logs.get("team_adv"), list)


def _nba_detail():
    from app.domains.nba.schemas_game_detail import GameDetailTeam, NbaGameDetail

    return NbaGameDetail(
        espn_event_id="401810001",
        status="scheduled",
        status_label="7:00 PM ET",
        venue="Chase Center",
        away=GameDetailTeam(
            id="9", abbrev="GS", name="Golden State Warriors", score=None, color="#1D428A"
        ),
        home=GameDetailTeam(
            id="18", abbrev="NY", name="New York Knicks", score=None, color="#006BB6"
        ),
        fg_made=0,
        fg_attempted=0,
        latest_play=None,
        shots=[],
        plays=[],
        win_probability=None,
        matchup_prediction=None,
        projected_starters=None,
        season_leaders=None,
        injuries=None,
        box_score=None,
        fetched_at="2026-10-19T12:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_nba_preview_keeps_ft_and_adds_cached_advanced_stats():
    from app.domains.nba.game_detail import _attach_season_team_stats
    from app.domains.nba.schemas_game_detail import (
        NbaSeasonTeamStatLine,
        NbaSeasonTeamStatsPair,
    )

    pair = NbaSeasonTeamStatsPair(
        away=NbaSeasonTeamStatLine(ft_pct="81.2", ft_pct_rank=4),
        home=NbaSeasonTeamStatLine(ft_pct="77.0"),
    )
    with (
        patch(
            "app.domains.nba.game_detail.fetch_season_team_stats_pair",
            new=AsyncMock(return_value=pair),
        ),
        patch(
            "app.domains.nba.game_detail.load_team_advanced",
            return_value={
                "GSW": {
                    "efg_pct": "54.0",
                    "efg_pct_rank": 8,
                    "ts_pct": "58.1",
                    "def_rtg": "110.4",
                    "pace": "99.2",
                },
                "NYK": {"efg_pct": "51.0", "ts_pct": "55.0"},
            },
        ),
    ):
        detail = await _attach_season_team_stats(_nba_detail())

    stats = detail.season_team_stats
    assert stats is not None
    assert stats.away.ft_pct == "81.2"
    assert stats.away.efg_pct == "54.0"
    assert stats.away.ts_pct == "58.1"
    assert stats.away.efg_pct_rank == 8
    assert stats.away.def_rtg == "110.4"
    assert stats.away.pace == "99.2"
    assert stats.home.efg_pct == "51.0"


@pytest.mark.asyncio
async def test_wnba_preview_maps_phx_to_cached_advanced_stats():
    from app.domains.wnba.game_detail import _attach_season_team_stats
    from app.domains.wnba.schemas_game_detail import (
        GameDetailTeam,
        WnbaGameDetail,
        WnbaSeasonTeamStatLine,
        WnbaSeasonTeamStatsPair,
    )

    detail = WnbaGameDetail(
        espn_event_id="401857099",
        status="scheduled",
        status_label="Scheduled",
        venue=None,
        away=GameDetailTeam(
            id="17", abbrev="PHX", name="Phoenix Mercury", score=None, color="#201747"
        ),
        home=GameDetailTeam(
            id="9", abbrev="NY", name="New York Liberty", score=None, color="#FFFFFF"
        ),
        fg_made=0,
        fg_attempted=0,
        latest_play=None,
        shots=[],
        plays=[],
        win_probability=None,
        matchup_prediction=None,
        projected_starters=None,
        season_leaders=None,
        injuries=None,
        box_score=None,
        fetched_at="2026-10-19T12:00:00+00:00",
    )
    pair = WnbaSeasonTeamStatsPair(
        away=WnbaSeasonTeamStatLine(ft_pct=".820"),
        home=WnbaSeasonTeamStatLine(ft_pct=".790"),
    )
    with (
        patch(
            "app.domains.wnba.game_detail.fetch_season_team_stats_pair",
            new=AsyncMock(return_value=pair),
        ),
        patch(
            "app.domains.wnba.game_detail.load_team_advanced",
            return_value={
                "PHO": {"efg_pct": "52.4", "ts_pct": "56.0", "pie": "51.2"},
                "NYL": {"efg_pct": "54.1", "ts_pct": "57.8"},
            },
        ),
    ):
        enriched = await _attach_season_team_stats(detail)

    stats = enriched.season_team_stats
    assert stats is not None
    assert stats.away.ft_pct == ".820"
    assert stats.away.efg_pct == "52.4"
    assert stats.away.ts_pct == "56.0"
    assert stats.home.efg_pct == "54.1"
