import json
from pathlib import Path

from app.providers.espn.mlb_roster import (
    headshot_url_for,
    roster_player_index,
)
from app.providers.espn.wnba_roster import norm_player_name

FIXTURES = Path(__file__).parent / "fixtures"


def test_headshot_url_for():
    assert headshot_url_for("33192") == (
        "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png"
    )


def test_roster_player_index_maps_name_position_team_headshot():
    payload = json.loads((FIXTURES / "espn_mlb_roster_nyy.json").read_text())
    index = roster_player_index(payload, team_abbrev="NYY")
    entry = index[norm_player_name("Aaron Judge")]
    assert entry["espn_id"] == "33192"
    assert entry["position"] == "RF"
    assert entry["team_abbrev"] == "NYY"
    assert entry["headshot_url"] == headshot_url_for("33192")


def test_roster_player_index_accepts_flat_athlete_list():
    payload = {
        "athletes": [
            {
                "id": "1",
                "displayName": "Flat Player",
                "position": {"abbreviation": "C"},
            }
        ]
    }
    index = roster_player_index(payload, team_abbrev="BOS")
    entry = index[norm_player_name("Flat Player")]
    assert entry["espn_id"] == "1"
    assert entry["position"] == "C"
    assert entry["team_abbrev"] == "BOS"
