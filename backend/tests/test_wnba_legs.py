from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core import odds_snapshots
from app.domains.betting.player_match_keys import match_player_key
from app.domains.wnba import scoreboard as scoreboard_mod
from app.domains.wnba.props import index_parlay_api_odds_by_book
from app.domains.wnba.schemas_scoreboard import WnbaGame, WnbaScoreboardResponse, WnbaTeam
from app.main import app
from app.providers.espn import wnba_roster
from app.providers.espn.wnba_roster import norm_player_name

_FAV_OVER, _FAV_UNDER = -200, 170
_EVEN_OVER, _EVEN_UNDER = -110, -110


def test_index_parlay_api_odds_maps_player_points():
    now = datetime.now(timezone.utc)
    rows = [
        {
            "sportsbook": "draftkings",
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 22.5,
            "american_price": -120,
            "scraped_at": now,
        },
        {
            "sportsbook": "draftkings",
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "under",
            "line_score": 22.5,
            "american_price": 100,
            "scraped_at": now,
        },
        {
            "sportsbook": "draftkings",
            "player_name": "Someone",
            "market_type": "player_foo_unknown",
            "side": "over",
            "line_score": 1.5,
            "american_price": -110,
            "scraped_at": now,
        },
    ]
    indexes = index_parlay_api_odds_by_book(rows)
    key = (match_player_key("A'ja Wilson"), "points", "over", 22.5)
    assert indexes["draftkings"][key]["american"] == -120
    assert (match_player_key("Someone"), "player_foo_unknown", "over", 1.5) not in indexes.get(
        "draftkings", {}
    )


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_legs_cache():
    import app.domains.wnba.legs as legs

    if hasattr(legs, "clear_wnba_legs_cache"):
        legs.clear_wnba_legs_cache()
    yield
    if hasattr(legs, "clear_wnba_legs_cache"):
        legs.clear_wnba_legs_cache()


def _fresh(minutes: float = 5.0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def _pp(player: str, stat: str, line: float, *, odds_type: str = "standard", scraped_at=None):
    return {
        "player_name": player,
        "stat_type": stat,
        "line_score": line,
        "odds_type": odds_type,
        "scraped_at": scraped_at if scraped_at is not None else _fresh(),
    }


def _side_row(*, player, stat, side, line, american, scraped_at=None, stake=100.0, market_field="stat_name"):
    row = {
        "player_name": player,
        market_field: stat,
        "side": side,
        "line_score": line,
        "american_price": american,
        "scraped_at": scraped_at if scraped_at is not None else _fresh(),
    }
    if stake is not None:
        row["stake"] = stake
    return row


def _two_way_rows(*, player, stat, line, over, under, market_field="stat_name", stake=100.0, scraped_at=None, sportsbook=None):
    rows = [
        _side_row(player=player, stat=stat, side="over", line=line, american=over, scraped_at=scraped_at, stake=stake, market_field=market_field),
        _side_row(player=player, stat=stat, side="under", line=line, american=under, scraped_at=scraped_at, stake=stake, market_field=market_field),
    ]
    if sportsbook:
        for row in rows:
            row["sportsbook"] = sportsbook
    return rows


def _play_books(player: str, line: float = 22.5):
    """Pinnacle + DK + MGM at the favorite price — PLAY for Power 4."""
    return {
        "px": [],
        "novig": [],
        "pin": _two_way_rows(
            player=player, stat="player_total_points", line=line,
            over=_FAV_OVER, under=_FAV_UNDER, market_field="market_type", stake=None,
        ),
        "parlay": (
            _two_way_rows(
                player=player, stat="player_points", line=line,
                over=_FAV_OVER, under=_FAV_UNDER, market_field="market_type",
                stake=None, sportsbook="draftkings",
            )
            + _two_way_rows(
                player=player, stat="player_points", line=line,
                over=_FAV_OVER, under=_FAV_UNDER, market_field="market_type",
                stake=None, sportsbook="betmgm",
            )
        ),
    }


def _game(eid: str, away: str, home: str, status: str) -> WnbaGame:
    return WnbaGame(
        id=eid,
        espn_event_id=eid,
        status=status,  # type: ignore[arg-type]
        status_label=status.title(),
        away=WnbaTeam(abbrev=away, name=away),
        home=WnbaTeam(abbrev=home, name=home),
        start_time_et="2026-08-30T19:00:00Z",
    )


def _scoreboard(*games: WnbaGame) -> WnbaScoreboardResponse:
    return WnbaScoreboardResponse(
        date="2026-08-30",
        games=list(games),
        fetched_at=_fresh().isoformat().replace("+00:00", "Z"),
    )


def _roster(*pairs: tuple[str, str]) -> dict:
    return {norm_player_name(name): {"team_abbrev": team} for name, team in pairs}


@pytest.fixture
def legs_io(monkeypatch):
    state: dict = {
        "pp": [], "ud": [], "px": [], "novig": [], "pin": [], "parlay": [],
        "roster": {}, "scoreboard": _scoreboard(),
    }

    def _wnba_only(league, **kwargs):
        assert league == "wnba", league
        return kwargs["rows"]

    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_prizepicks",
        lambda league="wnba": _wnba_only(league, rows=state["pp"]),
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_underdog",
        lambda league="wnba": _wnba_only(league, rows=state["ud"]),
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_prophetx",
        lambda league="wnba", mains_only=False: _wnba_only(league, rows=state["px"]),
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_novig",
        lambda league="wnba", mains_only=False: _wnba_only(league, rows=state["novig"]),
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_pinnacle",
        lambda league="wnba": _wnba_only(league, rows=state["pin"]),
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_parlay_api_odds",
        lambda league="wnba": _wnba_only(league, rows=state["parlay"]),
    )

    async def fake_roster():
        return state["roster"]

    async def fake_scoreboard():
        return state["scoreboard"]

    monkeypatch.setattr(wnba_roster, "get_wnba_player_index", fake_roster)
    monkeypatch.setattr(scoreboard_mod, "get_today_scoreboard", fake_scoreboard)
    return state


def _packed_plays(body):
    return [leg for entry in body.entries for leg in entry.legs]


def _assert_identity(body) -> None:
    dump = body.rejected_summary.model_dump()
    assert set(dump) == {
        "insufficient_coverage", "insufficient_sharp", "below_threshold",
        "unpriceable_payout", "unpacked_remainder",
    }
    assert body.legs_evaluated == body.legs_surfaced + sum(dump.values())
    assert body.legs_surfaced == sum(len(e.legs) for e in body.entries)


def test_route_rejects_prizepicks_flex_3(client):
    r = client.get("/api/wnba/legs", params={"app": "prizepicks", "format": "flex", "legs": 3})
    assert r.status_code == 422


def test_route_rejects_underdog_boosted(client):
    r = client.get("/api/wnba/legs", params={"app": "underdog", "format": "boosted", "legs": 4})
    assert r.status_code == 422


def test_route_prizepicks_power_4_is_empty_without_dfs(client, legs_io):
    r = client.get("/api/wnba/legs", params={"app": "prizepicks", "format": "power", "legs": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["payouts_assumed"] is True
    assert body["entries"] == []
    assert "legs" not in body
    assert body["lines_seeded"] == 0
    assert "prizepicks_unavailable" in body["warnings"]
    assert body["slate"].startswith("WNBA ")


@pytest.mark.asyncio
async def test_stale_dfs_keeps_lines_seeded_skips_play(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    stale = datetime.now(timezone.utc) - timedelta(minutes=70)
    legs_io["pp"] = [_pp("A'ja Wilson", "Points", 22.5, scraped_at=stale)]
    legs_io.update(_play_books("A'ja Wilson"))
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.lines_seeded == 1
    assert body.legs_evaluated == 0
    assert body.entries == []
    assert body.rejected_summary.unpacked_remainder == 0
    assert "dfs_snapshot_stale" in body.warnings
    assert body.coverage_funnel_ratio is None
    _assert_identity(body)


@pytest.mark.asyncio
async def test_live_and_halftime_dropped_before_pricer(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    legs_io["pp"] = [
        _pp("A'ja Wilson", "Points", 22.5),
        _pp("Jackie Young", "Points", 18.5),
        _pp("Napheesa Collier", "Points", 20.5),
    ]
    aja = _play_books("A'ja Wilson", 22.5)
    jackie = _play_books("Jackie Young", 18.5)
    naph = _play_books("Napheesa Collier", 20.5)
    legs_io["pin"] = aja["pin"] + jackie["pin"] + naph["pin"]
    legs_io["parlay"] = aja["parlay"] + jackie["parlay"] + naph["parlay"]
    legs_io["roster"] = _roster(
        ("A'ja Wilson", "LVA"), ("Jackie Young", "LVA"), ("Napheesa Collier", "MIN"),
    )
    legs_io["scoreboard"] = _scoreboard(
        _game("401", "LVA", "NYL", "live"),
        _game("402", "MIN", "SEA", "scheduled"),
        _game("403", "CON", "CHI", "halftime"),
    )
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.lines_seeded == 3
    assert body.legs_evaluated == 1
    assert body.rejected_summary.unpacked_remainder == 1
    packed = {leg.player for leg in _packed_plays(body)}
    assert packed == set()
    _assert_identity(body)


@pytest.mark.asyncio
async def test_espn_roster_lv_locks_against_canonical_lva_live(legs_io):
    """ESPN stores LV; scoreboard is LVA. Join must canonicalize or live lock misses."""
    from app.domains.wnba.legs import get_wnba_legs

    legs_io["pp"] = [_pp("A'ja Wilson", "Points", 22.5)]
    legs_io.update(_play_books("A'ja Wilson"))
    legs_io["roster"] = _roster(("A'ja Wilson", "LV"))
    legs_io["scoreboard"] = _scoreboard(_game("401", "LVA", "NYL", "live"))
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.lines_seeded == 1
    assert body.legs_evaluated == 0
    assert body.entries == []
    _assert_identity(body)


@pytest.mark.asyncio
async def test_demon_dropped_from_seed(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    legs_io["pp"] = [
        _pp("A'ja Wilson", "Points", 22.5, odds_type="standard"),
        _pp("A'ja Wilson", "Rebounds", 10.5, odds_type="demon"),
        _pp("Jackie Young", "Assists", 5.5, odds_type="goblin"),
    ]
    legs_io.update(_play_books("A'ja Wilson", 22.5))
    legs_io["roster"] = _roster(("A'ja Wilson", "LVA"))
    legs_io["scoreboard"] = _scoreboard(_game("401", "LVA", "NYL", "scheduled"))
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.lines_seeded == 1
    assert body.legs_evaluated == 1
    _assert_identity(body)


@pytest.mark.asyncio
async def test_off_line_pinnacle_does_not_pair(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    legs_io["pp"] = [_pp("A'ja Wilson", "Points", 22.5)]
    books = _play_books("A'ja Wilson", 22.5)
    legs_io["pin"] = _two_way_rows(
        player="A'ja Wilson", stat="player_total_points", line=23.5,
        over=_FAV_OVER, under=_FAV_UNDER, market_field="market_type", stake=None,
    )
    legs_io["parlay"] = books["parlay"]
    legs_io["roster"] = _roster(("A'ja Wilson", "LVA"))
    legs_io["scoreboard"] = _scoreboard(_game("401", "LVA", "NYL", "scheduled"))
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.legs_evaluated == 1
    assert body.rejected_summary.insufficient_sharp == 1
    _assert_identity(body)


@pytest.mark.asyncio
async def test_novig_null_stake_still_prices_with_coverage(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    players = [
        ("A'ja Wilson", 22.5, "LVA"),
        ("Jackie Young", 18.5, "LVA"),
        ("Napheesa Collier", 20.5, "MIN"),
        ("Breanna Stewart", 21.5, "NYL"),
    ]
    legs_io["pp"] = [_pp(name, "Points", line) for name, line, _ in players]
    pin, parlay, novig = [], [], []
    for name, line, _ in players:
        books = _play_books(name, line)
        pin.extend(books["pin"])
        parlay.extend(books["parlay"])
        novig.extend(_two_way_rows(
            player=name, stat="player_total_points", line=line,
            over=_FAV_OVER, under=_FAV_UNDER, market_field="stat_name", stake=None,
        ))
    legs_io["pin"] = pin
    legs_io["parlay"] = parlay
    legs_io["novig"] = novig
    legs_io["roster"] = _roster(*[(n, t) for n, _, t in players])
    legs_io["scoreboard"] = _scoreboard(
        _game("401", "LVA", "LAS", "scheduled"),
        _game("402", "MIN", "SEA", "scheduled"),
        _game("403", "NYL", "CON", "scheduled"),
    )
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert len(body.entries) == 1
    assert len(body.entries[0].legs) == 4
    assert {leg.game_id for leg in body.entries[0].legs} <= {"401", "402", "403"}
    assert body.coverage_funnel_ratio is not None
    assert body.slate.startswith("WNBA ")
    _assert_identity(body)


@pytest.mark.asyncio
async def test_prophetx_without_stake_is_excluded(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    legs_io["pp"] = [_pp("A'ja Wilson", "Points", 22.5)]
    legs_io["px"] = _two_way_rows(
        player="A'ja Wilson", stat="player_total_points", line=22.5,
        over=_FAV_OVER, under=_FAV_UNDER, market_field="stat_name", stake=None,
    )
    legs_io["parlay"] = _play_books("A'ja Wilson")["parlay"]
    legs_io["roster"] = _roster(("A'ja Wilson", "LVA"))
    legs_io["scoreboard"] = _scoreboard(_game("401", "LVA", "NYL", "scheduled"))
    body = await get_wnba_legs(app="prizepicks", format="power", legs=4)
    assert body.legs_evaluated == 1
    assert body.rejected_summary.insufficient_sharp == 1
    _assert_identity(body)


@pytest.mark.asyncio
async def test_flex_packs_six_skips_third_same_game(legs_io):
    from app.domains.wnba.legs import get_wnba_legs

    seeds = [
        ("A'ja Wilson", 22.5, "LVA"),
        ("Jackie Young", 18.5, "LVA"),
        ("Chelsea Gray", 12.5, "LVA"),
        ("Napheesa Collier", 20.5, "MIN"),
        ("Breanna Stewart", 21.5, "NYL"),
        ("Sabrina Ionescu", 19.5, "NYL"),
        ("Caitlin Clark", 17.5, "IND"),
    ]
    legs_io["pp"] = [_pp(n, "Points", line) for n, line, _ in seeds]
    pin, parlay = [], []
    for n, line, _ in seeds:
        books = _play_books(n, line)
        pin.extend(books["pin"])
        parlay.extend(books["parlay"])
    legs_io["pin"] = pin
    legs_io["parlay"] = parlay
    legs_io["roster"] = _roster(*[(n, t) for n, _, t in seeds])
    legs_io["scoreboard"] = _scoreboard(
        _game("401", "LVA", "LAS", "scheduled"),
        _game("402", "MIN", "SEA", "scheduled"),
        _game("403", "NYL", "CON", "scheduled"),
        _game("404", "IND", "CHI", "scheduled"),
    )
    body = await get_wnba_legs(app="prizepicks", format="flex", legs=6)
    assert len(body.entries) == 1
    assert len(body.entries[0].legs) == 6
    packed = {leg.player for leg in body.entries[0].legs}
    lva = [n for n in ("A'ja Wilson", "Jackie Young", "Chelsea Gray") if n in packed]
    assert len(lva) == 2
    assert body.flex_same_game_warning is False
    assert body.rejected_summary.unpacked_remainder == 1
    _assert_identity(body)
