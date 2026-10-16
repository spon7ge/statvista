import json
from pathlib import Path

from app.domains.nba.game_detail import (
    clear_game_detail_cache,
    normalize_espn_summary,
)

FIXTURES = Path(__file__).parent / "fixtures"


def setup_function() -> None:
    clear_game_detail_cache()


def test_normalize_espn_nba_summary_sets_league_and_teams() -> None:
    payload = json.loads((FIXTURES / "espn_nba_summary.json").read_text())

    detail = normalize_espn_summary(
        payload,
        espn_event_id="401810001",
        fetched_at="2026-10-15T17:30:00-04:00",
    )

    assert detail.league == "nba"
    assert detail.espn_event_id == "401810001"
    assert detail.away.abbrev == "NYK"
    assert detail.home.abbrev == "BOS"
