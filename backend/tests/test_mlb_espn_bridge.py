import json
from pathlib import Path

from app.providers.espn import mlb_bridge
from app.providers.espn.mlb_bridge import (
    match_espn_event_id,
    normalize_espn_mlb_win_probability,
)
from app.domains.mlb.game_detail import attach_win_probability, normalize_mlb_live_feed

FIXTURES = Path(__file__).parent / "fixtures"


def test_match_espn_event_id_by_abbrevs():
    board = json.loads((FIXTURES / "espn_mlb_scoreboard_day.json").read_text())
    eid = match_espn_event_id(board, away_abbrev="BOS", home_abbrev="LAD")
    assert eid == "401696123"  # use id from fixture


def test_normalize_win_probability_points_and_stakes():
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    wp = normalize_espn_mlb_win_probability(
        summary, home_abbrev="LAD", away_abbrev="BOS"
    )
    assert wp is not None
    assert len(wp.points) >= 2
    assert wp.stakes is not None
    assert wp.home_abbrev == "LAD"


def test_normalize_espn_mlb_matchup_prediction():
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    pred = mlb_bridge.normalize_espn_mlb_matchup_prediction(summary)
    assert pred is not None
    assert pred.away_win_pct == 59
    assert pred.home_win_pct == 41
    assert pred.source_label == "ESPN game projection"


def test_normalize_espn_mlb_matchup_prediction_missing():
    assert mlb_bridge.normalize_espn_mlb_matchup_prediction({}) is None
    assert mlb_bridge.normalize_espn_mlb_matchup_prediction({"predictor": {}}) is None


def test_attach_win_probability_adds_espn_source():
    detail = normalize_mlb_live_feed(
        json.loads((FIXTURES / "mlb_statsapi_live_feed.json").read_text()),
        game_pk="776543",
        fetched_at="2026-08-02T18:00:00+00:00",
    )
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    wp = normalize_espn_mlb_win_probability(
        summary, home_abbrev=detail.home.abbrev, away_abbrev=detail.away.abbrev
    )
    merged = attach_win_probability(detail, wp)
    assert merged.win_probability is not None
    assert "espn" in merged.sources
    assert "mlb_stats_api" in merged.sources
