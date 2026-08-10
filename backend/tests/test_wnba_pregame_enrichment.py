import json
from pathlib import Path

from app.domains.wnba.game_detail import attach_record_last10
from app.domains.wnba.schemas_game_detail import (
    GameDetailTeam,
    WnbaGameDetail,
    WnbaGameLeaderCard,
    WnbaGameLeaders,
    WnbaSeasonTeamStatLine,
    WnbaSeasonTeamStatsPair,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"
TEAM_SEASON_STATS_FIXTURE = json.loads(
    (_FIXTURES / "espn_wnba_team_season_stats.json").read_text()
)
SUMMARY_FIXTURE = json.loads(
    (_FIXTURES / "espn_wnba_summary_scheduled_preview.json").read_text()
)


def _minimal_scheduled_detail() -> WnbaGameDetail:
    return WnbaGameDetail(
        espn_event_id="401857099",
        status="scheduled",
        status_label="Scheduled",
        venue=None,
        away=GameDetailTeam(
            id="17", abbrev="LVA", name="Las Vegas Aces", score=None, color="#000000"
        ),
        home=GameDetailTeam(
            id="9", abbrev="NYL", name="New York Liberty", score=None, color="#FFFFFF"
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
        fetched_at="2026-08-10T12:00:00-04:00",
    )


def test_game_detail_team_accepts_record_and_last10():
    t = GameDetailTeam(
        id="1", abbrev="LVA", name="Aces", score=None, color="#000",
        record="22-8", last_10="7-3",
    )
    assert t.record == "22-8"
    assert t.last_10 == "7-3"


def test_season_team_stats_and_game_leaders_shapes():
    line = WnbaSeasonTeamStatLine(pts=92.0, pts_rank=3, reb=34.0, reb_rank=5)
    pair = WnbaSeasonTeamStatsPair(away=line, home=line)
    leaders = WnbaGameLeaders(
        leaders=[
            WnbaGameLeaderCard(
                key="ppg", label="PPG", rank=1, value="26.6",
                player_id="9", last_name="Wilson", team_abbrev="LVA",
                side="away", headshot_url=None,
            )
        ]
    )
    assert pair.away.pts_rank == 3
    assert leaders.leaders[0].key == "ppg"


def test_attach_record_last10():
    detail = _minimal_scheduled_detail()
    out = attach_record_last10(
        detail,
        {"17": ("22-8", "7-3"), "9": ("20-10", "6-4")},
    )
    assert out.away.record == "22-8"
    assert out.away.last_10 == "7-3"
    assert out.home.record == "20-10"
    assert out.home.last_10 == "6-4"


def test_attach_record_last10_missing_team_leaves_null():
    detail = _minimal_scheduled_detail()
    out = attach_record_last10(detail, {})
    assert out.away.record is None
    assert out.away.last_10 is None


def test_normalize_team_stats_pair_assigns_ranks():
    from app.domains.wnba.team_season_stats import normalize_season_team_stats_pair

    # fixture: 3 teams including away/home ids
    pair = normalize_season_team_stats_pair(
        TEAM_SEASON_STATS_FIXTURE, away_id="17", home_id="9"
    )
    assert pair is not None
    assert pair.away.pts is not None
    assert pair.away.pts_rank is not None
    assert pair.home.to_rank is not None  # lower TO → better rank
    # pts: 17=92.0 (1), 9=90.7 (2), 5=85.0 (3)
    assert pair.away.pts == 92.0
    assert pair.away.pts_rank == 1
    assert pair.home.pts_rank == 2
    # to: 17=12.1 (1), 9=13.8 (2), 5=16.0 (3) — lower better
    assert pair.away.to_rank == 1
    assert pair.home.to_rank == 2
    assert pair.away.fg_pct == "48.8"
    assert pair.home.fg_pct == "46.5"


def test_attach_season_team_stats():
    from app.domains.wnba.game_detail import attach_season_team_stats

    pair = WnbaSeasonTeamStatsPair(
        away=WnbaSeasonTeamStatLine(pts=92.0, pts_rank=1),
        home=WnbaSeasonTeamStatLine(pts=90.7, pts_rank=2),
    )
    out = attach_season_team_stats(_minimal_scheduled_detail(), pair)
    assert out.season_team_stats is not None
    assert out.season_team_stats.away.pts == 92.0


def test_attach_season_team_stats_none_noop():
    from app.domains.wnba.game_detail import attach_season_team_stats

    detail = _minimal_scheduled_detail()
    assert attach_season_team_stats(detail, None) is detail


def _fixture_away_home() -> tuple[GameDetailTeam, GameDetailTeam]:
    return (
        GameDetailTeam(
            id="away1",
            abbrev="MIN",
            name="Minnesota Lynx",
            score=None,
            color="#266092",
        ),
        GameDetailTeam(
            id="home1",
            abbrev="TOR",
            name="Toronto Tempo",
            score=None,
            color="#CE1141",
        ),
    )


def test_build_game_leaders_picks_best_per_category():
    from app.domains.wnba.game_leaders import build_game_leaders_from_summary

    away_team, home_team = _fixture_away_home()
    leaders = build_game_leaders_from_summary(SUMMARY_FIXTURE, away_team, home_team)
    assert leaders is not None
    keys = [c.key for c in leaders.leaders]
    assert keys == ["ppg", "rpg", "apg"]
    by_key = {c.key: c for c in leaders.leaders}
    assert by_key["ppg"].last_name == "Mabrey"
    assert by_key["ppg"].side == "home"
    assert by_key["ppg"].team_abbrev == "TOR"
    assert by_key["ppg"].value == "21.1"
    assert by_key["ppg"].label == "PPG"
    assert by_key["rpg"].last_name == "Howard"
    assert by_key["rpg"].side == "away"
    assert by_key["rpg"].value == "7.9"
    assert by_key["apg"].last_name == "Miles"
    assert by_key["apg"].side == "away"
    assert by_key["apg"].value == "6.0"


def test_attach_game_leaders():
    from app.domains.wnba.game_detail import attach_game_leaders

    leaders = WnbaGameLeaders(
        leaders=[
            WnbaGameLeaderCard(
                key="ppg",
                label="PPG",
                rank=None,
                value="21.1",
                player_id="4066387",
                last_name="Mabrey",
                team_abbrev="TOR",
                side="home",
                headshot_url=None,
            )
        ]
    )
    out = attach_game_leaders(_minimal_scheduled_detail(), leaders)
    assert out.game_leaders is not None
    assert out.game_leaders.leaders[0].last_name == "Mabrey"


def test_attach_game_leaders_none_noop():
    from app.domains.wnba.game_detail import attach_game_leaders

    detail = _minimal_scheduled_detail()
    assert attach_game_leaders(detail, None) is detail
