from __future__ import annotations

import json
from pathlib import Path

from app.domains.nba.scoreboard import (
    combine_with_overnight_carryover,
    format_tip_label,
    normalize_espn_scoreboard,
    slate_et_date,
)
from app.domains.nba.schemas_scoreboard import NbaGame, NbaTeam
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
FIXTURES = Path(__file__).parent / "fixtures"


def test_normalize_espn_sets_league_venue_records_logos_and_live_label():
    payload = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())
    g = normalize_espn_scoreboard(payload, date_et="2026-10-15")[0]
    assert g.league == "nba"
    assert g.espn_event_id == "401810001"
    assert g.id == "espn-401810001"
    assert g.status == "live"
    assert g.status_label == "Q3 4:20"
    assert g.venue == "Crypto.com Arena"
    assert g.venue_city == "Los Angeles"
    assert g.away.abbrev == "GSW"
    assert g.away.record == "0-1"
    assert g.home.abbrev == "LAL"
    assert g.home.logo_url.endswith("/lal.png")


def test_normalize_espn_final_and_scheduled():
    final_payload = {
        "events": [
            {
                "id": "1",
                "date": "2026-10-15T00:00Z",
                "competitions": [
                    {
                        "competitors": [
                            {
                                "homeAway": "home",
                                "score": "110",
                                "team": {
                                    "abbreviation": "BOS",
                                    "displayName": "Boston Celtics",
                                },
                            },
                            {
                                "homeAway": "away",
                                "score": "100",
                                "team": {
                                    "abbreviation": "NYK",
                                    "displayName": "New York Knicks",
                                },
                            },
                        ]
                    }
                ],
                "status": {
                    "type": {
                        "state": "post",
                        "completed": True,
                        "name": "STATUS_FINAL",
                    }
                },
            }
        ]
    }
    g = normalize_espn_scoreboard(final_payload, date_et="2026-10-15")[0]
    assert g.status == "final"
    assert g.status_label == "Final"
    assert g.away.score == 100
    assert g.home.score == 110


def test_combine_with_overnight_carryover_keeps_live_yesterday():
    today = [
        NbaGame(
            id="espn-2",
            espn_event_id="2",
            status="scheduled",
            status_label="7:00 PM ET",
            away=NbaTeam(abbrev="BOS", name="Boston Celtics"),
            home=NbaTeam(abbrev="MIA", name="Miami Heat"),
            start_time_et="2026-10-16T23:00:00Z",
        )
    ]
    yesterday = [
        NbaGame(
            id="espn-1",
            espn_event_id="1",
            status="live",
            status_label="Q4 1:00",
            away=NbaTeam(abbrev="GSW", name="Golden State Warriors", score=95),
            home=NbaTeam(abbrev="LAL", name="Los Angeles Lakers", score=98),
            start_time_et="2026-10-16T02:00:00Z",
        )
    ]
    merged = combine_with_overnight_carryover(today, yesterday)
    assert [g.espn_event_id for g in merged] == ["1", "2"]


def test_slate_et_date_lags_until_3am():
    assert (
        slate_et_date(now=datetime(2026, 10, 16, 2, 30, tzinfo=ET))
        == "2026-10-15"
    )
    assert (
        slate_et_date(now=datetime(2026, 10, 16, 3, 0, tzinfo=ET))
        == "2026-10-16"
    )


def test_format_tip_label():
    assert format_tip_label("2026-10-15T23:00:00Z") is not None
