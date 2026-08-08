from app.domains.mlb.game_detail import normalize_mlb_live_feed


def _minimal_payload(**overrides):
    base = {
        "gameData": {
            "status": {"abstractGameState": "Final", "detailedState": "Final"},
            "datetime": {"officialDate": "2026-08-07"},
            "teams": {
                "away": {"id": 147, "abbreviation": "NYY", "name": "Yankees"},
                "home": {"id": 111, "abbreviation": "BOS", "name": "Red Sox"},
            },
            "venue": {
                "name": "Yankee Stadium",
                "location": {"city": "Bronx", "state": "New York"},
            },
            "weather": {"condition": "Cloudy", "temp": "74", "wind": "2 mph N"},
        },
        "liveData": {
            "boxscore": {
                "officials": [
                    {
                        "officialType": "Home Plate",
                        "official": {"fullName": "Mark Ripperger"},
                    },
                    {
                        "officialType": "First Base",
                        "official": {"fullName": "Dan Merzel"},
                    },
                    {
                        "officialType": "Second Base",
                        "official": {"fullName": "Dan Bellino"},
                    },
                    {
                        "officialType": "Third Base",
                        "official": {"fullName": "Derek Thomas"},
                    },
                    {
                        "officialType": "Left Field",
                        "official": {"fullName": "Ignore Me"},
                    },
                ]
            },
            "linescore": {},
            "plays": {"allPlays": []},
        },
    }
    base.update(overrides)
    return base


def test_normalize_game_info_fields():
    detail = normalize_mlb_live_feed(_minimal_payload(), game_pk="1", fetched_at="t")
    assert detail.venue == "Yankee Stadium"
    assert detail.venue_city == "Bronx"
    assert detail.venue_state == "New York"
    assert detail.weather is not None
    assert detail.weather.temp_f == "74"
    assert detail.weather.condition == "Cloudy"
    assert detail.weather.wind == "2 mph N"
    assert detail.umpires is not None
    assert detail.umpires.home_plate == "Mark Ripperger"
    assert detail.umpires.first_base == "Dan Merzel"
    assert detail.umpires.second_base == "Dan Bellino"
    assert detail.umpires.third_base == "Derek Thomas"


def test_normalize_game_info_soft_missing():
    payload = _minimal_payload()
    payload["gameData"]["venue"] = {"name": "Somewhere"}
    payload["gameData"].pop("weather", None)
    payload["liveData"]["boxscore"] = {}
    detail = normalize_mlb_live_feed(payload, game_pk="1", fetched_at="t")
    assert detail.venue_city is None
    assert detail.venue_state is None
    assert detail.weather is None
    assert detail.umpires is None
