from app.domains.nba.schemas_game_detail import NbaGameDetail


def test_nba_game_detail_league_literal():
    detail = NbaGameDetail(
        espn_event_id="401810001",
        status="scheduled",
        status_label="7:00 PM ET",
        venue="Crypto.com Arena",
        away={
            "id": "13",
            "abbrev": "LAL",
            "name": "Los Angeles Lakers",
            "score": None,
            "color": "#552583",
        },
        home={
            "id": "9",
            "abbrev": "GSW",
            "name": "Golden State Warriors",
            "score": None,
            "color": "#1D428A",
        },
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
        fetched_at="2026-10-15T00:00:00Z",
    )
    assert detail.league == "nba"
