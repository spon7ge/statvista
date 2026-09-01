import json
from pathlib import Path

from app.providers.espn.mlb_roster import (
    headshot_url_for,
    lookup_roster_player,
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


def test_lookup_roster_player_finds_jr_when_query_omits_jr():
    index = {
        norm_player_name("Fernando Tatis Jr."): {
            "espn_id": "32512",
            "position": "RF",
            "team_abbrev": "SD",
            "headshot_url": headshot_url_for("32512"),
        }
    }
    hit = lookup_roster_player(index, "Fernando Tatis", "fernando tatis")
    assert hit is not None
    assert hit["espn_id"] == "32512"
    assert hit["team_abbrev"] == "SD"


def test_lookup_roster_player_keeps_exact_short_name_if_present():
    index = {
        norm_player_name("Luis Garcia"): {
            "espn_id": "1",
            "position": "P",
            "team_abbrev": "HOU",
            "headshot_url": None,
        },
        norm_player_name("Luis García Jr."): {
            "espn_id": "2",
            "position": "2B",
            "team_abbrev": "WSH",
            "headshot_url": None,
        },
    }
    hit = lookup_roster_player(index, "Luis Garcia", "luis garcia")
    assert hit is not None
    assert hit["espn_id"] == "1"
