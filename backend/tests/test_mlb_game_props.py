import inspect
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import game_props as gp
from app.domains.mlb.game_props import pick_best_quote, best_side_quote, group_game_prop_categories
from app.domains.mlb.schemas_game_props import MlbGamePropPlayer
from app.domains.mlb.prop_stat_keys import display_stat_label
from app.main import app
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.parlay.mlb_props import ParlayMlbNormalized


async def _async_return(value):
    return value


async def _async_raise_lookup(*_a, **_k):
    raise LookupError("missing")


def _side(player, stat, side, line, american):
    key = (player.strip().casefold(), stat, side, round(float(line), 2))
    return key, {"american": american, "changed_at": None}


def _parlay(
    *,
    board: list[dict] | None = None,
    book_indexes: dict | None = None,
    as_of: str | None = None,
    unavailable: bool = False,
) -> ParlayMlbNormalized:
    return ParlayMlbNormalized(
        prizepicks_board=board or [],
        book_indexes=book_indexes or {},
        as_of=as_of,
        unavailable=unavailable,
    )


def _fake_detail(away="NYY", home="BOS"):
    return SimpleNamespace(
        away=SimpleNamespace(abbrev=away),
        home=SimpleNamespace(abbrev=home),
    )


def _stub_snapshots(
    monkeypatch,
    *,
    parlay: ParlayMlbNormalized | None = None,
    parlay_error: Exception | None = None,
    parlay_soft_empty: bool = False,
    ud_board: list[dict] | None = None,
):
    async def fake_parlay(**_k):
        if parlay_error is not None:
            raise parlay_error
        if parlay_soft_empty:
            return _parlay(unavailable=True)
        if parlay is not None:
            return parlay
        return _parlay()

    monkeypatch.setattr(gp, "fetch_mlb_parlay_props_normalized", fake_parlay)
    monkeypatch.setattr(gp, "fetch_latest_underdog", lambda league="mlb": ud_board or [])
    monkeypatch.setattr(gp, "fetch_latest_prophetx", lambda league="mlb": [])
    monkeypatch.setattr(gp, "fetch_latest_novig", lambda league="mlb": [])
    monkeypatch.setattr(gp, "fetch_latest_pinnacle", lambda league="mlb": [])


def test_game_props_module_does_not_import_odds_api():
    source = inspect.getsource(gp)
    assert "odds_api" not in source
    assert "fetch_mlb_props_normalized" not in source
    assert "odds_api_unavailable" not in source


def test_book_priority_only_five_books():
    expected = ("prophetx", "novig", "draftkings", "fanduel", "pinnacle")
    assert gp.BOOK_PRIORITY == expected


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    # Same american; prophetx before draftkings in BOOK_PRIORITY
    q = pick_best_quote([("draftkings", 100), ("prophetx", 100)])
    assert q is not None
    assert q.book == "prophetx"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_best_side_quote_reads_indexes():
    indexes = {
        "draftkings": {("judge", "home_runs", "over", 0.5): {"american": 250}},
        "fanduel": {("judge", "home_runs", "over", 0.5): {"american": 270}},
        "prophetx": {},
    }
    q = best_side_quote(
        indexes, norm_player="judge", stat_key="home_runs", side="over", line=0.5
    )
    assert q is not None
    assert q.american == 270
    assert q.book == "fanduel"


def test_group_game_prop_categories_stable_order():
    players = {
        "hits": [
            MlbGamePropPlayer(
                player_name="A", team_abbrev="NYY", headshot_url=None,
                line=1.5, over=None, under=None,
            )
        ],
        "home_runs": [
            MlbGamePropPlayer(
                player_name="B", team_abbrev="BOS", headshot_url=None,
                line=0.5, over=None, under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["home_runs", "hits"]
    assert cats[0].label == display_stat_label("home_runs")


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_filters_teams_and_both_sides(monkeypatch):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    pp_board = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Home Runs",
            "line_score": 0.5,
            "odds_type": "standard",
        },
        {
            "player_name": "Juan Soto",
            "stat_type": "Hits",
            "line_score": 1.5,
            "odds_type": "standard",
        },
        {
            "player_name": "Bryce Harper",
            "stat_type": "Hits",
            "line_score": 1.5,
            "odds_type": "standard",
        },
    ]
    jo, joq = _side("Aaron Judge", "home_runs", "over", 0.5, 250)
    ju, juq = _side("Aaron Judge", "home_runs", "under", 0.5, -140)
    fo, foq = _side("Aaron Judge", "home_runs", "over", 0.5, 270)
    book_indexes = {
        "draftkings": {jo: joq, ju: juq},
        "fanduel": {fo: foq},
    }
    _stub_snapshots(
        monkeypatch,
        parlay=_parlay(board=pp_board, book_indexes=book_indexes),
    )
    monkeypatch.setattr(
        gp,
        "get_mlb_player_index",
        lambda: _async_return(
            {
                norm_player_name("Aaron Judge"): {
                    "team_abbrev": "NYY",
                    "headshot_url": "http://judge",
                    "position": "OF",
                },
                norm_player_name("Juan Soto"): {
                    "team_abbrev": "BOS",
                    "headshot_url": None,
                    "position": "OF",
                },
                norm_player_name("Bryce Harper"): {
                    "team_abbrev": "PHI",
                    "headshot_url": None,
                    "position": "OF",
                },
            }
        ),
    )

    res = await gp.get_mlb_props_for_game(game_pk="746123", app="prizepicks")
    names = {
        p.player_name
        for c in res.categories
        for p in c.players
    }
    assert "Aaron Judge" in names
    assert "Juan Soto" in names
    assert "Bryce Harper" not in names
    judge = next(
        p for c in res.categories for p in c.players if p.player_name == "Aaron Judge"
    )
    assert judge.over is not None
    assert judge.over.american == 270
    assert judge.over.book == "fanduel"
    assert judge.under is not None
    assert judge.under.american == -140
    assert judge.under.book == "draftkings"


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_unsupported_app():
    with pytest.raises(ValueError, match="unsupported app"):
        await gp.get_mlb_props_for_game(game_pk="746123", app="kalshi")


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_underdog_filters_ud_board(monkeypatch):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    ud_board = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "home_runs",
            "line_score": 0.5,
            "side": "over",
            "american_price": 250,
            "payout_multiplier": 1.2,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "home_runs",
            "line_score": 0.5,
            "side": "under",
            "american_price": -140,
            "payout_multiplier": 0.9,
        },
        {
            "player_name": "Bryce Harper",
            "stat_name": "hits",
            "line_score": 1.5,
            "side": "over",
            "american_price": -110,
            "payout_multiplier": 1.0,
        },
    ]
    _stub_snapshots(monkeypatch, parlay=_parlay(), ud_board=ud_board)
    monkeypatch.setattr(
        gp,
        "get_mlb_player_index",
        lambda: _async_return(
            {
                norm_player_name("Aaron Judge"): {
                    "team_abbrev": "NYY",
                    "headshot_url": "http://judge",
                    "position": "OF",
                },
                norm_player_name("Bryce Harper"): {
                    "team_abbrev": "PHI",
                    "headshot_url": None,
                    "position": "OF",
                },
            }
        ),
    )

    res = await gp.get_mlb_props_for_game(game_pk="746123", app="underdog")
    assert res.app == "underdog"
    assert res.error is None
    names = {p.player_name for c in res.categories for p in c.players}
    assert "Aaron Judge" in names
    assert "Bryce Harper" not in names
    assert any(c.stat == "home_runs" for c in res.categories)


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_parlay_soft_fail_underdog_still_has_categories(
    monkeypatch,
):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    ud_board = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "home_runs",
            "line_score": 0.5,
            "side": "over",
            "american_price": 250,
            "payout_multiplier": 1.2,
        },
    ]

    _stub_snapshots(
        monkeypatch,
        parlay_error=RuntimeError("parlay down"),
        ud_board=ud_board,
    )
    monkeypatch.setattr(
        gp,
        "get_mlb_player_index",
        lambda: _async_return(
            {
                norm_player_name("Aaron Judge"): {
                    "team_abbrev": "NYY",
                    "headshot_url": None,
                    "position": "OF",
                },
            }
        ),
    )

    res = await gp.get_mlb_props_for_game(game_pk="746123", app="underdog")
    assert res.error == "parlay_unavailable"
    assert len(res.categories) > 0
    names = {p.player_name for c in res.categories for p in c.players}
    assert "Aaron Judge" in names


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_roster_failure_sets_error(monkeypatch):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    pp_board = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Home Runs",
            "line_score": 0.5,
            "odds_type": "standard",
        },
    ]
    _stub_snapshots(monkeypatch, parlay=_parlay(board=pp_board))

    async def roster_raises():
        raise RuntimeError("espn down")

    monkeypatch.setattr(gp, "get_mlb_player_index", roster_raises)

    res = await gp.get_mlb_props_for_game(game_pk="746123", app="prizepicks")
    assert res.error == "roster_unavailable"
    assert res.categories == []


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_composes_parlay_and_roster_errors(monkeypatch):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    _stub_snapshots(monkeypatch, parlay_error=RuntimeError("parlay down"))

    async def roster_raises():
        raise RuntimeError("espn down")

    monkeypatch.setattr(gp, "get_mlb_player_index", roster_raises)

    res = await gp.get_mlb_props_for_game(game_pk="746123", app="prizepicks")
    assert res.error == "parlay_unavailable,roster_unavailable"
    assert res.categories == []


def test_route_game_props_404(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(gp, "get_mlb_game_detail", _async_raise_lookup)
    res = client.get("/api/mlb/props/game/99999999?app=prizepicks")
    assert res.status_code == 404


def test_route_game_props_422_bad_app():
    client = TestClient(app)
    res = client.get("/api/mlb/props/game/746123?app=notabook")
    assert res.status_code == 422
