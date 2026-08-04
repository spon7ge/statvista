import asyncio
import json
import time
from pathlib import Path

import pytest

from app.services import mlb_game_detail as svc
from app.services.mlb_game_detail import (
    attach_last10,
    normalize_mlb_live_feed,
    parse_standings_last10,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _payload():
    return json.loads((FIXTURES / "mlb_statsapi_live_feed.json").read_text())


def test_normalize_live_status_and_linescore():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.mlb_game_pk == "776543"
    assert detail.status == "live"
    assert detail.linescore is not None
    assert detail.linescore.away.runs >= 0
    assert detail.sources == ["mlb_stats_api"]
    assert detail.win_probability is None


def test_normalize_situation_and_pitches():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.situation is not None
    assert detail.situation.outs >= 0
    assert len(detail.situation.pitches) >= 1


def test_normalize_situation_player_card_summaries():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    situation = detail.situation
    assert situation is not None

    assert situation.at_bat is not None
    assert situation.at_bat.name == "Teoscar Hernández"
    assert situation.at_bat.hand == "RHB"
    assert situation.at_bat.summary is not None
    assert ".250" in situation.at_bat.summary
    assert "1-3 | R" in situation.at_bat.summary
    assert situation.at_bat.summary.endswith("today")

    assert situation.on_deck is not None
    assert situation.on_deck.name == "Wilyer Abreu"
    assert situation.on_deck.hand == "LHB"
    assert situation.on_deck.summary is not None
    assert ".264" in situation.on_deck.summary
    assert "2-3" in situation.on_deck.summary

    assert situation.pitching is not None
    assert situation.pitching.name == "Justin Slaten"
    assert situation.pitching.hand == "RHP"
    assert situation.pitching.summary is not None
    assert "5 P" in situation.pitching.summary
    assert "0.1 IP" in situation.pitching.summary


def test_normalize_plays_box_and_hits():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert len(detail.plays) >= 1
    assert any(p.scoring for p in detail.scoring_plays) or len(detail.scoring_plays) >= 0
    assert detail.box_score is not None
    assert len(detail.box_score.away_batters) + len(detail.box_score.home_batters) >= 1

    rafaela = next(
        (b for b in detail.box_score.away_batters if b.name == "Ceddanne Rafaela"),
        None,
    )
    assert rafaela is not None
    assert rafaela.hr == 1
    assert rafaela.sb == 0

    teoscar = next(
        (b for b in detail.box_score.home_batters if "Teoscar" in b.name),
        None,
    )
    assert teoscar is not None
    assert teoscar.hr == 0
    assert teoscar.sb == 1


def test_normalize_final_additions_from_mutated_payload():
    payload = _payload()
    payload["gameData"].setdefault("datetime", {})
    payload["gameData"]["datetime"]["officialDate"] = "2026-08-02"
    payload["gameData"]["teams"]["away"]["record"] = {
        "leagueRecord": {"wins": 58, "losses": 55}
    }
    payload["gameData"]["teams"]["home"]["leagueRecord"] = {"wins": 60, "losses": 53}
    payload["liveData"]["decisions"] = {
        "winner": {"fullName": "Brandon Pfaadt", "id": 1},
        "loser": {"fullName": "Michael King", "id": 2},
    }
    for play in payload["liveData"]["plays"]["allPlays"]:
        for event in play.get("playEvents") or []:
            if isinstance(event, dict) and "hitData" in event:
                event["hitData"]["launchSpeed"] = 104.1
                event["hitData"]["launchAngle"] = 28.0
                event["hitData"]["totalDistance"] = 404
                break
        else:
            continue
        break
    payload["liveData"]["boxscore"]["teams"]["away"]["teamStats"] = {
        "batting": {
            "homeRuns": 0,
            "runs": 1,
            "hits": 6,
            "stolenBases": 0,
            "leftOnBase": 7,
            "avg": ".188",
            "obp": ".250",
            "slg": ".300",
        },
        "pitching": {"era": "5.00", "strikeOuts": 8},
    }
    payload["liveData"]["boxscore"]["teams"]["home"]["teamStats"] = {
        "batting": {
            "homeRuns": 1,
            "runs": 5,
            "hits": 9,
            "stolenBases": 1,
            "leftOnBase": 6,
            "avg": ".300",
            "obp": ".360",
            "slg": ".500",
        },
        "pitching": {"era": "1.00", "strikeOuts": 10},
    }

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )

    assert detail.away.record == "58-55"
    assert detail.home.record == "60-53"
    assert detail.game_date_label
    assert detail.decisions is not None
    assert detail.decisions.winner == "Brandon Pfaadt"
    assert detail.decisions.loser == "Michael King"
    asserted = False
    for play in detail.plays:
        if play.exit_velo is not None:
            assert play.exit_velo == 104.1
            assert play.launch_angle == 28.0
            assert play.total_distance == 404
            asserted = True
            break
    assert asserted
    scoring = [play for play in detail.plays if play.scoring]
    assert all(play.scoring_team in ("away", "home") for play in scoring)
    assert detail.team_stats is not None
    assert detail.team_stats.home.hr == 1
    assert detail.team_stats.away.avg == ".188"


def test_normalize_box_notes_and_enriched_pitchers():
    payload = _payload()
    away = payload["liveData"]["boxscore"]["teams"]["away"]
    home = payload["liveData"]["boxscore"]["teams"]["home"]
    away["info"] = [
        {
            "title": "BATTING",
            "fieldList": [
                {"label": "2B", "value": "Rafaela."},
                {"label": "Team LOB", "value": "5."},
            ],
        },
        {
            "title": "BASERUNNING",
            "fieldList": [{"label": "SB", "value": "Rafaela."}],
        },
    ]
    home["info"] = [
        {
            "title": "BATTING",
            "fieldList": [{"label": "HR", "value": "Hernández."}],
        },
        {
            "title": "FIELDING",
            "fieldList": [{"label": "E", "value": "Betts."}],
        },
    ]
    pitchers = away.get("pitchers") or []
    assert pitchers, "fixture needs pitchers"
    pid = f"ID{pitchers[0]}"
    player = away["players"][pid]
    player.setdefault("stats", {}).setdefault("pitching", {})
    player["stats"]["pitching"].update(
        {
            "homeRuns": 1,
            "strikes": 57,
            "groundOuts": 4,
            "flyOuts": 3,
            "battersFaced": 22,
            "inheritedRunners": 0,
            "inheritedRunnersScored": 0,
            "note": "(L, 1-1)",
            "numberOfPitches": 90,
        }
    )
    player.setdefault("seasonStats", {}).setdefault("pitching", {})["era"] = "3.21"
    away.setdefault("teamStats", {}).setdefault("pitching", {}).update(
        {
            "inningsPitched": "9.0",
            "hits": 8,
            "runs": 4,
            "earnedRuns": 4,
            "baseOnBalls": 2,
            "strikeOuts": 9,
            "homeRuns": 1,
            "era": "4.50",
        }
    )

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    box = detail.box_score
    assert box is not None
    assert box.away_batting_notes[0].label == "2B"
    assert box.away_batting_notes[0].value == "Rafaela."
    assert box.away_baserunning_notes[0].label == "SB"
    assert box.home_fielding_notes[0].label == "E"
    assert box.home_batting_notes[0].label == "HR"

    starter = box.away_pitchers[0]
    assert starter.decision == "(L, 1-1)"
    assert starter.hr == 1
    assert starter.era == "3.21"
    assert starter.strikes == 57
    assert starter.ground_outs == 4
    assert starter.fly_outs == 3
    assert starter.batters_faced == 22
    assert box.away_pitching_totals is not None
    assert box.away_pitching_totals.ip == "9.0"
    assert box.away_pitching_totals.k == 9


def test_normalize_scheduled_status_label_uses_et_first_pitch():
    payload = _payload()
    payload["gameData"]["status"] = {
        "abstractGameState": "Preview",
        "detailedState": "Scheduled",
    }
    payload["gameData"].setdefault("datetime", {})
    payload["gameData"]["datetime"]["dateTime"] = "2026-08-02T23:20:00Z"
    payload["liveData"]["linescore"] = {}

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.status == "scheduled"
    assert detail.status_label == "7:20 PM ET"


def test_normalize_scheduled_status_label_falls_back_without_datetime():
    payload = _payload()
    payload["gameData"]["status"] = {
        "abstractGameState": "Preview",
        "detailedState": "Scheduled",
    }
    payload["gameData"]["datetime"] = {}
    payload["liveData"]["linescore"] = {}

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.status == "scheduled"
    assert detail.status_label == "Scheduled"


def test_parse_standings_last10_from_split_records():
    payload = json.loads((FIXTURES / "mlb_standings_sample.json").read_text())
    mapping = parse_standings_last10(payload)
    assert mapping["120"] == "0-5"
    assert mapping["143"] == "3-2"


def test_attach_last10_sets_both_teams():
    payload = _payload()
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    # Force known ids if fixture ids differ — use detail.away.id / home.id
    mapping = {
        detail.away.id: "0-5",
        detail.home.id: "3-2",
    }
    enriched = attach_last10(detail, mapping)
    assert enriched.away.last_10 == "0-5"
    assert enriched.home.last_10 == "3-2"


def test_attach_last10_leaves_null_when_missing():
    payload = _payload()
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    enriched = attach_last10(detail, {})
    assert enriched.away.last_10 is None
    assert enriched.home.last_10 is None


def _scheduled_payload() -> dict:
    payload = _payload()
    payload["gameData"]["status"] = {
        "abstractGameState": "Preview",
        "detailedState": "Scheduled",
    }
    payload["liveData"]["linescore"] = {}
    return payload


def test_get_mlb_game_detail_soft_fails_standings(monkeypatch):
    svc.clear_mlb_game_detail_cache()
    payload = _scheduled_payload()

    async def fake_live_feed(game_pk: str) -> dict:
        return payload

    async def fake_resolve_espn(**kwargs):
        return None

    async def fake_standings() -> dict:
        raise RuntimeError("standings unavailable")

    monkeypatch.setattr(svc, "fetch_mlb_live_feed", fake_live_feed)
    monkeypatch.setattr(svc, "resolve_espn_event_id", fake_resolve_espn)
    monkeypatch.setattr(svc, "fetch_mlb_standings", fake_standings)

    detail = asyncio.run(svc.get_mlb_game_detail("776543"))

    assert detail.status == "scheduled"
    assert detail.away.last_10 is None
    assert detail.home.last_10 is None
    # Failure still stamps the negative cache so a hang isn't retried on
    # every scheduled-detail request within the TTL window.
    assert svc._standings_cache["expires_at"] > 0.0


def test_get_mlb_game_detail_attaches_standings_last10(monkeypatch):
    svc.clear_mlb_game_detail_cache()
    payload = _scheduled_payload()
    standings = json.loads((FIXTURES / "mlb_standings_sample.json").read_text())
    away_id = payload["gameData"]["teams"]["away"]["id"]
    home_id = payload["gameData"]["teams"]["home"]["id"]
    standings["records"][0]["teamRecords"][0]["team"]["id"] = away_id
    standings["records"][0]["teamRecords"][1]["team"]["id"] = home_id

    async def fake_live_feed(game_pk: str) -> dict:
        return payload

    async def fake_resolve_espn(**kwargs):
        return None

    async def fake_standings() -> dict:
        return standings

    monkeypatch.setattr(svc, "fetch_mlb_live_feed", fake_live_feed)
    monkeypatch.setattr(svc, "resolve_espn_event_id", fake_resolve_espn)
    monkeypatch.setattr(svc, "fetch_mlb_standings", fake_standings)

    detail = asyncio.run(svc.get_mlb_game_detail("776543"))

    assert detail.away.last_10 == "0-5"
    assert detail.home.last_10 == "3-2"


def test_get_mlb_game_detail_skips_standings_for_live_game(monkeypatch):
    """Only the scheduled/pregame UI shows last_10, so live/final games
    should never trigger the standings round-trip."""
    svc.clear_mlb_game_detail_cache()
    payload = _payload()
    assert payload["gameData"]["status"]["abstractGameState"] == "Live"

    standings_calls = 0

    async def fake_live_feed(game_pk: str) -> dict:
        return payload

    async def fake_resolve_espn(**kwargs):
        return None

    async def fake_standings() -> dict:
        nonlocal standings_calls
        standings_calls += 1
        return {"records": []}

    monkeypatch.setattr(svc, "fetch_mlb_live_feed", fake_live_feed)
    monkeypatch.setattr(svc, "resolve_espn_event_id", fake_resolve_espn)
    monkeypatch.setattr(svc, "fetch_mlb_standings", fake_standings)

    detail = asyncio.run(svc.get_mlb_game_detail("776543"))

    assert detail.status == "live"
    assert standings_calls == 0
    assert detail.away.last_10 is None
    assert detail.home.last_10 is None


def test_standings_last10_map_negative_caches_on_failure(monkeypatch):
    svc.clear_mlb_game_detail_cache()
    calls = 0

    async def fake_standings() -> dict:
        nonlocal calls
        calls += 1
        raise RuntimeError("standings down")

    monkeypatch.setattr(svc, "fetch_mlb_standings", fake_standings)

    with pytest.raises(RuntimeError):
        asyncio.run(svc._standings_last10_map())
    assert calls == 1
    assert svc._standings_cache["expires_at"] > time.time()

    # A second call within the TTL window should not retry the failing
    # upstream call — it should reuse the negative cache.
    mapping = asyncio.run(svc._standings_last10_map())
    assert mapping == {}
    assert calls == 1
