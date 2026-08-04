import json
from pathlib import Path

from app.services.mlb_game_detail import normalize_mlb_live_feed

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
