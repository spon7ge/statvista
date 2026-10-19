"""NFL PrizePicks league defaults. No live network."""

from __future__ import annotations

import pytest

from src.scrapers.nfl import nfl_prizepick as pp


def test_default_league_is_nfl() -> None:
    assert pp.DEFAULT_LEAGUES == (("NFL", 9),)
    assert pp.DEFAULT_LEAGUE_NAMES == ("NFL",)
    # Captcha wait probes a small board so it does not download the NFL payload.
    assert pp._CLEARANCE_PROBE_LEAGUE_ID == 3


def test_projections_url_uses_league_id() -> None:
    assert pp.projections_api_url(9) == (
        "https://api.prizepicks.com/projections?league_id=9&per_page=250&single_stat=true"
    )


def test_env_override_wins_over_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PRIZEPICKS_RESOLVE_LEAGUES", raising=False)
    monkeypatch.setenv("PRIZEPICKS_NFL_LEAGUE_ID", "99")
    assert pp.resolve_leagues(("NFL",)) == (("NFL", 99),)


def test_projection_defaults_to_nfl() -> None:
    row = pp.Projection(
        player="A",
        stat_type="Pass Yards",
        line_score=250.5,
        odds_type="standard",
        updated_at="",
    )
    assert row.league == "NFL"
