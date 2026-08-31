from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core import odds_snapshots
from app.domains.mlb import scoreboard as scoreboard_mod
from app.domains.mlb.schemas_scoreboard import MlbGame, MlbScoreboardResponse, MlbTeam
from app.main import app
from app.providers.espn import mlb_roster
from app.providers.espn.wnba_roster import norm_player_name

# Strong favorite over — same pin as legs_pricer tests (hold ~0.037, fair ~0.643).
_FAV_OVER, _FAV_UNDER = -200, 170
_EVEN_OVER, _EVEN_UNDER = -110, -110


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _isolate_legs_cache():
    import app.domains.mlb.legs as legs

    if hasattr(legs, "clear_mlb_legs_cache"):
        legs.clear_mlb_legs_cache()
    yield
    if hasattr(legs, "clear_mlb_legs_cache"):
        legs.clear_mlb_legs_cache()


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


def _ud(player: str, stat: str, line: float, *, scraped_at=None, payout_multiplier: float = 1.0):
    return {
        "player_name": player,
        "stat_name": stat,
        "line_score": line,
        "side": "over",
        "payout_multiplier": payout_multiplier,
        "scraped_at": scraped_at if scraped_at is not None else _fresh(),
    }


def _under_fav_books(player: str, stat_px: str, stat_pin: str, line: float):
    """Pinnacle + DK + MGM with Under as the favorite (swap of _play_books prices)."""
    return {
        "px": [],
        "novig": [],
        "pin": _two_way_rows(
            player=player,
            stat=stat_pin,
            line=line,
            over=_FAV_UNDER,
            under=_FAV_OVER,
            market_field="market_type",
            stake=None,
        ),
        "parlay": (
            _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_UNDER,
                under=_FAV_OVER,
                market_field="market_type",
                stake=None,
                sportsbook="draftkings",
            )
            + _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_UNDER,
                under=_FAV_OVER,
                market_field="market_type",
                stake=None,
                sportsbook="betmgm",
            )
        ),
    }


def _side_row(
    *,
    player: str,
    stat: str,
    side: str,
    line: float,
    american: int,
    scraped_at=None,
    stake: float | None = 100.0,
    market_field: str = "stat_name",
):
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


def _two_way_rows(
    *,
    player: str,
    stat: str,
    line: float,
    over: int,
    under: int,
    market_field: str = "stat_name",
    stake: float | None = 100.0,
    scraped_at=None,
    sportsbook: str | None = None,
):
    rows = [
        _side_row(
            player=player,
            stat=stat,
            side="over",
            line=line,
            american=over,
            scraped_at=scraped_at,
            stake=stake,
            market_field=market_field,
        ),
        _side_row(
            player=player,
            stat=stat,
            side="under",
            line=line,
            american=under,
            scraped_at=scraped_at,
            stake=stake,
            market_field=market_field,
        ),
    ]
    if sportsbook:
        for row in rows:
            row["sportsbook"] = sportsbook
    return rows


def _play_books(player: str, stat_px: str, stat_pin: str, line: float):
    """Pinnacle + DK + MGM at the favorite price — PLAY for Power 4."""
    return {
        "px": [],
        "novig": [],
        "pin": _two_way_rows(
            player=player,
            stat=stat_pin,
            line=line,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
        ),
        "parlay": (
            _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_OVER,
                under=_FAV_UNDER,
                market_field="market_type",
                stake=None,
                sportsbook="draftkings",
            )
            + _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_OVER,
                under=_FAV_UNDER,
                market_field="market_type",
                stake=None,
                sportsbook="betmgm",
            )
        ),
    }


def _game(pk: str, away: str, home: str, status: str) -> MlbGame:
    return MlbGame(
        id=f"mlb-{pk}",
        mlb_game_pk=str(pk),
        status=status,  # type: ignore[arg-type]
        status_label=status.title(),
        away=MlbTeam(abbrev=away, name=away),
        home=MlbTeam(abbrev=home, name=home),
        start_time_et="2026-08-29T23:00:00Z",
    )


def _scoreboard(*games: MlbGame) -> MlbScoreboardResponse:
    return MlbScoreboardResponse(
        date="2026-08-29",
        games=list(games),
        fetched_at=_fresh().isoformat().replace("+00:00", "Z"),
    )


def _roster(*pairs: tuple[str, str]) -> dict:
    return {norm_player_name(name): {"team_abbrev": team} for name, team in pairs}


@pytest.fixture
def legs_io(monkeypatch):
    """Mock snapshot / Parlay / scoreboard / roster I/O. Do not fake odds_* schemas."""
    state: dict = {
        "pp": [],
        "ud": [],
        "px": [],
        "novig": [],
        "pin": [],
        "parlay": [],
        "roster": {},
        "scoreboard": _scoreboard(),
    }

    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_prizepicks", lambda league="mlb": state["pp"]
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_underdog", lambda league="mlb": state["ud"]
    )
    monkeypatch.setattr(
        odds_snapshots,
        "fetch_latest_prophetx",
        lambda league="mlb", mains_only=False: state["px"],
    )
    monkeypatch.setattr(
        odds_snapshots,
        "fetch_latest_novig",
        lambda league="mlb", mains_only=False: state["novig"],
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_pinnacle", lambda league="mlb": state["pin"]
    )
    monkeypatch.setattr(
        odds_snapshots, "fetch_latest_parlay_api_odds", lambda league="mlb": state["parlay"]
    )

    async def fake_roster():
        return state["roster"]

    async def fake_scoreboard():
        return state["scoreboard"]

    monkeypatch.setattr(mlb_roster, "get_mlb_player_index", fake_roster)
    monkeypatch.setattr(scoreboard_mod, "get_today_scoreboard", fake_scoreboard)
    return state


def _packed_plays(body):
    return [leg for entry in body.entries for leg in entry.legs]


def _assert_identity(body) -> None:
    rejected = body.rejected_summary
    dump = rejected.model_dump()
    assert set(dump) == {
        "insufficient_coverage",
        "insufficient_sharp",
        "below_threshold",
        "unpriceable_payout",
        "unpacked_remainder",
    }
    assert body.legs_evaluated == body.legs_surfaced + sum(dump.values())
    assert body.legs_surfaced == sum(len(e.legs) for e in body.entries)


def test_route_rejects_prizepicks_flex_3(client):
    r = client.get(
        "/api/mlb/legs",
        params={"app": "prizepicks", "format": "flex", "legs": 3},
    )
    assert r.status_code == 422


def test_route_rejects_underdog_boosted(client):
    r = client.get(
        "/api/mlb/legs",
        params={"app": "underdog", "format": "boosted", "legs": 4},
    )
    assert r.status_code == 422


def test_route_prizepicks_power_4_is_empty_without_dfs(client, legs_io):
    r = client.get(
        "/api/mlb/legs",
        params={"app": "prizepicks", "format": "power", "legs": 4},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["payouts_assumed"] is True
    assert body["entries"] == []
    assert "legs" not in body
    assert body["lines_seeded"] == 0
    assert "prizepicks_unavailable" in body["warnings"]


@pytest.mark.asyncio
async def test_stale_dfs_keeps_lines_seeded_skips_play(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    stale = datetime.now(timezone.utc) - timedelta(minutes=70)
    legs_io["pp"] = [_pp("Aaron Judge", "Total Bases", 1.5, scraped_at=stale)]
    books = _play_books("Aaron Judge", "total_bases", "batter_total_bases", 1.5)
    legs_io.update(books)

    body = await get_mlb_legs(app="prizepicks", format="power", legs=4)

    assert body.lines_seeded == 1
    assert body.legs_evaluated == 0
    assert body.entries == []
    assert body.rejected_summary.unpacked_remainder == 0
    assert body.legs_surfaced == 0
    assert "dfs_snapshot_stale" in body.warnings
    assert body.dfs_snapshot_age_minutes is not None
    assert body.dfs_snapshot_age_minutes > 60
    assert body.coverage_funnel_ratio is None
    _assert_identity(body)


@pytest.mark.asyncio
async def test_live_game_dropped_before_pricer(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["pp"] = [
        _pp("Aaron Judge", "Total Bases", 1.5),
        _pp("Juan Soto", "Hits", 1.5),
    ]
    judge = _play_books("Aaron Judge", "total_bases", "batter_total_bases", 1.5)
    soto = _play_books("Juan Soto", "hits", "batter_hits", 1.5)
    legs_io["pin"] = judge["pin"] + soto["pin"]
    legs_io["parlay"] = judge["parlay"] + soto["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Juan Soto", "NYM"))
    legs_io["scoreboard"] = _scoreboard(
        _game("111", "NYY", "BOS", "live"),
        _game("222", "NYM", "PHI", "scheduled"),
    )

    body = await get_mlb_legs(app="prizepicks", format="power", legs=4)

    assert body.lines_seeded == 2
    assert body.legs_evaluated == 1
    assert body.entries == []
    assert body.rejected_summary.unpacked_remainder == 1
    players = {leg.player for leg in _packed_plays(body)}
    assert "Aaron Judge" not in players
    _assert_identity(body)


@pytest.mark.asyncio
async def test_demon_dropped_from_seed(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["pp"] = [
        _pp("Aaron Judge", "Total Bases", 1.5, odds_type="standard"),
        _pp("Aaron Judge", "Home Runs", 0.5, odds_type="demon"),
        _pp("Juan Soto", "Hits", 1.5, odds_type="goblin"),
    ]
    books = _play_books("Aaron Judge", "total_bases", "batter_total_bases", 1.5)
    legs_io.update(books)
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="prizepicks", format="power", legs=4)

    assert body.lines_seeded == 1
    assert body.legs_evaluated == 1
    assert body.entries == []
    assert body.rejected_summary.unpacked_remainder == 1
    packed = _packed_plays(body)
    assert all(leg.variant == "standard" for leg in packed)
    assert all(leg.market != "Home Runs" for leg in packed)
    _assert_identity(body)


@pytest.mark.asyncio
async def test_identity_on_mixed_fixture(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["pp"] = [
        _pp("Aaron Judge", "Total Bases", 1.5),
        _pp("Juan Soto", "Hits", 1.5),
        _pp("Mookie Betts", "Runs", 0.5),
        _pp("Shohei Ohtani", "Home Runs", 0.5),
    ]
    play = _play_books("Aaron Judge", "total_bases", "batter_total_bases", 1.5)
    # Soto: supporting books only → insufficient_sharp
    soto_parlay = (
        _two_way_rows(
            player="Juan Soto",
            stat="batter_hits",
            line=1.5,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="draftkings",
        )
        + _two_way_rows(
            player="Juan Soto",
            stat="batter_hits",
            line=1.5,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="fanduel",
        )
        + _two_way_rows(
            player="Juan Soto",
            stat="batter_hits",
            line=1.5,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="betmgm",
        )
    )
    # Betts: Pinnacle + MGM + Caesars → insufficient_coverage
    betts_pin = _two_way_rows(
        player="Mookie Betts",
        stat="batter_runs",
        line=0.5,
        over=_FAV_OVER,
        under=_FAV_UNDER,
        market_field="market_type",
        stake=None,
    )
    betts_parlay = (
        _two_way_rows(
            player="Mookie Betts",
            stat="batter_runs",
            line=0.5,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="betmgm",
        )
        + _two_way_rows(
            player="Mookie Betts",
            stat="batter_runs",
            line=0.5,
            over=_FAV_OVER,
            under=_FAV_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="caesars",
        )
    )
    # Ohtani: even two-way → below_threshold
    ohtani_pin = _two_way_rows(
        player="Shohei Ohtani",
        stat="batter_home_runs",
        line=0.5,
        over=_EVEN_OVER,
        under=_EVEN_UNDER,
        market_field="market_type",
        stake=None,
    )
    ohtani_parlay = (
        _two_way_rows(
            player="Shohei Ohtani",
            stat="batter_home_runs",
            line=0.5,
            over=_EVEN_OVER,
            under=_EVEN_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="draftkings",
        )
        + _two_way_rows(
            player="Shohei Ohtani",
            stat="batter_home_runs",
            line=0.5,
            over=_EVEN_OVER,
            under=_EVEN_UNDER,
            market_field="market_type",
            stake=None,
            sportsbook="fanduel",
        )
    )
    legs_io["pin"] = play["pin"] + betts_pin + ohtani_pin
    legs_io["parlay"] = play["parlay"] + soto_parlay + betts_parlay + ohtani_parlay
    legs_io["roster"] = _roster(
        ("Aaron Judge", "NYY"),
        ("Juan Soto", "NYM"),
        ("Mookie Betts", "LAD"),
        ("Shohei Ohtani", "LAD"),
    )
    legs_io["scoreboard"] = _scoreboard(
        _game("111", "NYY", "BOS", "scheduled"),
        _game("222", "NYM", "PHI", "scheduled"),
        _game("333", "LAD", "SF", "scheduled"),
    )

    body = await get_mlb_legs(app="prizepicks", format="power", legs=4)

    assert body.lines_seeded == 4
    assert body.legs_evaluated == 4
    assert body.rejected_summary.insufficient_sharp == 1
    assert body.rejected_summary.insufficient_coverage == 1
    assert body.rejected_summary.below_threshold == 1
    assert body.rejected_summary.unpriceable_payout == 0
    assert body.rejected_summary.unpacked_remainder == 1
    assert body.entries == []
    assert body.legs_surfaced == 0
    assert body.coverage_funnel_ratio == pytest.approx(2 / 4)
    assert body.break_even_min is None
    assert body.break_even_max is None
    _assert_identity(body)


@pytest.mark.asyncio
async def test_flex_same_game_warning_when_top_cluster(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    seeds = [
        _pp("Aaron Judge", "Total Bases", 1.5),
        _pp("Giancarlo Stanton", "Home Runs", 0.5),
        _pp("Anthony Volpe", "Hits", 1.5),
    ]
    legs_io["pp"] = seeds
    pin = []
    parlay = []
    for player, px_stat, pin_stat, line in (
        ("Aaron Judge", "total_bases", "batter_total_bases", 1.5),
        ("Giancarlo Stanton", "home_runs", "batter_home_runs", 0.5),
        ("Anthony Volpe", "hits", "batter_hits", 1.5),
    ):
        books = _play_books(player, px_stat, pin_stat, line)
        pin.extend(books["pin"])
        parlay.extend(books["parlay"])
    legs_io["pin"] = pin
    legs_io["parlay"] = parlay
    legs_io["roster"] = _roster(
        ("Aaron Judge", "NYY"),
        ("Giancarlo Stanton", "NYY"),
        ("Anthony Volpe", "NYY"),
    )
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="prizepicks", format="flex", legs=6)

    assert body.entries == []
    assert body.flex_same_game_warning is False
    assert body.rejected_summary.unpacked_remainder == 3
    assert body.legs_surfaced == 0
    _assert_identity(body)


@pytest.mark.asyncio
async def test_flex_packs_six_skips_third_same_game(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    seeds = [
        _pp("Aaron Judge", "Total Bases", 1.5),
        _pp("Giancarlo Stanton", "Home Runs", 0.5),
        _pp("Anthony Volpe", "Hits", 1.5),
        _pp("Juan Soto", "Hits", 1.5),
        _pp("Mookie Betts", "Runs", 0.5),
        _pp("Kyle Tucker", "Total Bases", 1.5),
        _pp("Ronald Acuna", "Stolen Bases", 0.5),
    ]
    legs_io["pp"] = seeds
    pin = []
    parlay = []
    for player, px_stat, pin_stat, line in (
        ("Aaron Judge", "total_bases", "batter_total_bases", 1.5),
        ("Giancarlo Stanton", "home_runs", "batter_home_runs", 0.5),
        ("Anthony Volpe", "hits", "batter_hits", 1.5),
        ("Juan Soto", "hits", "batter_hits", 1.5),
        ("Mookie Betts", "runs", "batter_runs", 0.5),
        ("Kyle Tucker", "total_bases", "batter_total_bases", 1.5),
        ("Ronald Acuna", "stolen_bases", "batter_stolen_bases", 0.5),
    ):
        books = _play_books(player, px_stat, pin_stat, line)
        pin.extend(books["pin"])
        parlay.extend(books["parlay"])
    legs_io["pin"] = pin
    legs_io["parlay"] = parlay
    legs_io["roster"] = _roster(
        ("Aaron Judge", "NYY"),
        ("Giancarlo Stanton", "NYY"),
        ("Anthony Volpe", "NYY"),
        ("Juan Soto", "NYM"),
        ("Mookie Betts", "LAD"),
        ("Kyle Tucker", "HOU"),
        ("Ronald Acuna", "ATL"),
    )
    legs_io["scoreboard"] = _scoreboard(
        _game("111", "NYY", "BOS", "scheduled"),
        _game("222", "NYM", "PHI", "scheduled"),
        _game("333", "LAD", "SF", "scheduled"),
        _game("444", "HOU", "TEX", "scheduled"),
        _game("555", "ATL", "MIA", "scheduled"),
    )

    body = await get_mlb_legs(app="prizepicks", format="flex", legs=6)

    assert len(body.entries) == 1
    assert len(body.entries[0].legs) == 6
    packed_players = {leg.player for leg in body.entries[0].legs}
    same_game = [
        name
        for name in ("Aaron Judge", "Giancarlo Stanton", "Anthony Volpe")
        if name in packed_players
    ]
    assert len(same_game) == 2
    assert body.flex_same_game_warning is False
    assert body.rejected_summary.unpacked_remainder == 1
    _assert_identity(body)


def test_two_way_at_line_pairs_over_and_under():
    from app.domains.mlb.legs import _two_way_at_line
    from app.domains.betting.player_match_keys import match_player_key

    now = datetime.now(timezone.utc)
    player_key = match_player_key("Aaron Judge")
    line = 1.5
    index = {
        (player_key, "total_bases", "over", line): {
            "american": -120,
            "changed_at": now - timedelta(minutes=10),
            "stake": 50.0,
        },
        (player_key, "total_bases", "under", line): {
            "american": 100,
            "changed_at": now - timedelta(minutes=12),
            "stake": 40.0,
        },
    }
    quote = _two_way_at_line(
        index,
        player_key=player_key,
        stat="total_bases",
        line=line,
        book="novig",
        now=now,
    )
    assert quote is not None
    assert quote.book == "novig"
    assert quote.over == -120
    assert quote.under == 100
    assert quote.stake_over == 50.0
    assert quote.stake_under == 40.0
    assert quote.age_minutes == pytest.approx(12.0)

    one_sided = {
        (player_key, "total_bases", "over", line): {
            "american": -120,
            "changed_at": now,
            "stake": 50.0,
        }
    }
    assert (
        _two_way_at_line(
            one_sided,
            player_key=player_key,
            stat="total_bases",
            line=line,
            book="novig",
            now=now,
        )
        is None
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "ud_stat, pin_stat, market",
    [
        ("home_runs", "batter_home_runs", "Home Runs"),
        ("singles", "batter_singles", "Singles"),
        ("batter_strikeouts", "batter_strikeouts", "Hitter Strikeouts"),
        ("stolen_bases", "batter_stolen_bases", "Stolen Bases"),
        ("walks", "batter_walks", "Walks"),
        ("doubles", "batter_doubles", "Doubles"),
    ],
)
async def test_underdog_over_only_markets_do_not_play_under(
    legs_io, ud_stat, pin_stat, market
):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["ud"] = [
        _ud("Aaron Judge", ud_stat, 0.5),
        _ud("Giancarlo Stanton", ud_stat, 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", ud_stat, pin_stat, 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", ud_stat, pin_stat, 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Giancarlo Stanton", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="underdog", format="standard", legs=2)

    packed = _packed_plays(body)
    assert all(not (leg.market == market and leg.side == "under") for leg in packed)
    assert body.entries == []
    assert body.legs_evaluated == 2
    assert body.rejected_summary.below_threshold == 2
    _assert_identity(body)


@pytest.mark.asyncio
async def test_underdog_hits_still_play_under(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["ud"] = [
        _ud("Aaron Judge", "hits", 0.5),
        _ud("Giancarlo Stanton", "hits", 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", "hits", "batter_hits", 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", "hits", "batter_hits", 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Giancarlo Stanton", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="underdog", format="standard", legs=2)

    packed = _packed_plays(body)
    assert len(body.entries) == 1
    assert {leg.side for leg in packed} == {"under"}
    assert all(leg.market == "Hits" for leg in packed)
    _assert_identity(body)


@pytest.mark.asyncio
async def test_prizepicks_home_runs_can_still_play_under(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["pp"] = [
        _pp("Aaron Judge", "Home Runs", 0.5),
        _pp("Giancarlo Stanton", "Home Runs", 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", "home_runs", "batter_home_runs", 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", "home_runs", "batter_home_runs", 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Giancarlo Stanton", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="prizepicks", format="power", legs=2)

    packed = _packed_plays(body)
    assert len(body.entries) == 1
    assert {leg.side for leg in packed} == {"under"}
    assert all(leg.market == "Home Runs" for leg in packed)
    _assert_identity(body)


@pytest.mark.asyncio
async def test_play_includes_roster_headshot(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    shot = "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png"
    legs_io["ud"] = [
        _ud("Aaron Judge", "hits", 0.5),
        _ud("Giancarlo Stanton", "hits", 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", "hits", "batter_hits", 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", "hits", "batter_hits", 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = {
        norm_player_name("Aaron Judge"): {
            "team_abbrev": "NYY",
            "headshot_url": shot,
        },
        norm_player_name("Giancarlo Stanton"): {"team_abbrev": "NYY"},
    }
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="underdog", format="standard", legs=2)

    by_player = {leg.player: leg for leg in _packed_plays(body)}
    assert by_player["Aaron Judge"].headshot_url == shot
    assert by_player["Giancarlo Stanton"].headshot_url is None
