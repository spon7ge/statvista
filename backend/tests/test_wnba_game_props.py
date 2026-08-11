import pytest
from app.domains.wnba import game_props as gp
from app.domains.wnba.game_props import pick_best_quote, group_game_prop_categories
from app.domains.wnba.schemas_game_props import WnbaGamePropPlayer
from app.domains.betting.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label
from app.domains.betting.schemas_props import WnbaPropBookQuote, WnbaPropLine, WnbaPropsResponse
from app.providers.espn.wnba_team_player_stats import RosterAthlete


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    q = pick_best_quote([("draftkings", 100), ("novig", 100)])
    assert q is not None
    assert q.book == "novig"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_group_game_prop_categories_stable_order():
    players = {
        "assists": [
            WnbaGamePropPlayer(
                player_name="A",
                team_abbrev="MIN",
                headshot_url=None,
                line=5.5,
                over=None,
                under=None,
            )
        ],
        "points": [
            WnbaGamePropPlayer(
                player_name="B",
                team_abbrev="SEA",
                headshot_url=None,
                line=18.5,
                over=None,
                under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["points", "assists"]
    assert cats[0].label == display_stat_label("points")


def test_game_prop_category_order_includes_core():
    assert "points" in GAME_PROP_CATEGORY_ORDER
    assert "rebounds" in GAME_PROP_CATEGORY_ORDER
    assert "assists" in GAME_PROP_CATEGORY_ORDER
    assert GAME_PROP_CATEGORY_ORDER.index("points") < GAME_PROP_CATEGORY_ORDER.index(
        "rebounds"
    )


def _quote(line: float, american: int | None) -> WnbaPropBookQuote:
    return WnbaPropBookQuote(line=line, odds_american=american)


def _line(**kwargs) -> WnbaPropLine:
    base = dict(
        player_name="N. Collier",
        team_abbrev="MIN",
        logo_url=None,
        stat="Points",
        market_type="player_points",
        side="over",
        game_date=None,
        commence_time=None,
        model_prediction=None,
        over_under_pct=None,
        ev=None,
        fanduel=None,
        draftkings=None,
        caesars=None,
        betmgm=None,
        pinnacle=None,
        bet365=None,
        prizepicks=None,
        underdog=None,
        betr=None,
        novig=None,
        sleeper=None,
        betrivers=None,
    )
    base.update(kwargs)
    return WnbaPropLine(**base)


@pytest.mark.asyncio
async def test_get_wnba_props_for_game_filters_teams_and_both_sides(monkeypatch):
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="over",
                prizepicks=_quote(22.5, None),
                draftkings=_quote(22.5, -110),
                fanduel=_quote(22.5, -105),
            ),
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="under",
                prizepicks=_quote(22.5, None),
                draftkings=_quote(22.5, -110),
                novig=_quote(22.5, 100),
            ),
            _line(
                player_name="J. Loyd",
                team_abbrev="SEA",
                side="over",
                prizepicks=_quote(18.5, None),
                draftkings=_quote(18.5, -115),
            ),
            _line(
                player_name="A. Wilson",
                team_abbrev="LVA",
                side="over",
                prizepicks=_quote(20.5, None),
                draftkings=_quote(20.5, -120),
            ),
        ],
    )

    class FakeTeam:
        id = "1"
        abbrev = "MIN"

    class FakeHome:
        id = "2"
        abbrev = "SEA"

    class FakeDetail:
        away = FakeTeam()
        home = FakeHome()

    async def fake_detail(_id: str):
        return FakeDetail()

    async def fake_today():
        return today

    async def fake_roster(_team_id: str):
        return []

    monkeypatch.setattr(gp, "get_game_detail", fake_detail)
    monkeypatch.setattr(gp, "get_today_props", fake_today)
    monkeypatch.setattr(gp, "fetch_team_roster_athletes", fake_roster)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert res.away_abbrev == "MIN"
    assert res.home_abbrev == "SEA"
    assert len(res.categories) == 1
    players = res.categories[0].players
    names = {p.player_name for p in players}
    assert names == {"N. Collier", "J. Loyd"}
    collier = next(p for p in players if p.player_name == "N. Collier")
    assert collier.line == 22.5
    assert collier.over is not None and collier.over.american == -105
    assert collier.over.book == "fanduel"
    assert collier.under is not None and collier.under.american == 100
    assert collier.under.book == "novig"


@pytest.mark.asyncio
async def test_get_wnba_props_for_game_unsupported_app():
    with pytest.raises(ValueError):
        await gp.get_wnba_props_for_game(espn_event_id="401770001", app="kalshi")


async def _patch_game_props_deps(monkeypatch, today: WnbaPropsResponse):
    class FakeTeam:
        id = "1"
        abbrev = "MIN"

    class FakeHome:
        id = "2"
        abbrev = "SEA"

    class FakeDetail:
        away = FakeTeam()
        home = FakeHome()

    async def fake_detail(_id: str):
        return FakeDetail()

    async def fake_today():
        return today

    async def fake_roster(_team_id: str):
        return []

    monkeypatch.setattr(gp, "get_game_detail", fake_detail)
    monkeypatch.setattr(gp, "get_today_props", fake_today)
    monkeypatch.setattr(gp, "fetch_team_roster_athletes", fake_roster)


@pytest.mark.asyncio
async def test_opposite_side_quotes_without_dfs_on_under_row(monkeypatch):
    """DFS line only on over still finds under sportsbook quotes from sibling row."""
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="over",
                prizepicks=_quote(22.5, None),
                draftkings=_quote(22.5, -110),
            ),
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="under",
                # No prizepicks on under — sportsbook under must still attach
                draftkings=_quote(22.5, -105),
                novig=_quote(22.5, 100),
            ),
        ],
    )
    await _patch_game_props_deps(monkeypatch, today)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert len(res.categories) == 1
    collier = res.categories[0].players[0]
    assert collier.line == 22.5
    assert collier.over is not None and collier.over.book == "draftkings"
    assert collier.under is not None and collier.under.american == 100
    assert collier.under.book == "novig"


@pytest.mark.asyncio
async def test_one_sided_quote_leaves_other_side_null(monkeypatch):
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="J. Loyd",
                team_abbrev="SEA",
                side="over",
                prizepicks=_quote(18.5, None),
                draftkings=_quote(18.5, -115),
            ),
        ],
    )
    await _patch_game_props_deps(monkeypatch, today)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert len(res.categories) == 1
    loyd = res.categories[0].players[0]
    assert loyd.over is not None
    assert loyd.under is None


@pytest.mark.asyncio
async def test_roster_partial_failure_keeps_other_team_headshots(monkeypatch):
    """Away roster fetch fails; home headshots still indexed and error is set."""
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="J. Loyd",
                team_abbrev="SEA",
                side="over",
                prizepicks=_quote(18.5, None),
                draftkings=_quote(18.5, -115),
            ),
        ],
    )
    await _patch_game_props_deps(monkeypatch, today)

    home_headshot = "https://example.com/loyd.png"

    async def fake_roster(team_id: str):
        if team_id == "1":
            raise RuntimeError("ESPN away roster down")
        return [
            RosterAthlete(
                player_id="123",
                name="J. Loyd",
                jersey="24",
                position="G",
                headshot_url=home_headshot,
                last_name="Loyd",
            )
        ]

    monkeypatch.setattr(gp, "fetch_team_roster_athletes", fake_roster)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert res.error is not None and "roster_unavailable" in res.error
    assert len(res.categories) == 1
    loyd = res.categories[0].players[0]
    assert loyd.player_name == "J. Loyd"
    assert loyd.headshot_url == home_headshot


@pytest.mark.asyncio
async def test_empty_categories_when_no_dfs_for_matchup(monkeypatch):
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="A. Wilson",
                team_abbrev="LVA",
                side="over",
                prizepicks=_quote(20.5, None),
                draftkings=_quote(20.5, -120),
            ),
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="over",
                # Matchup team but no DFS for requested app
                draftkings=_quote(22.5, -110),
            ),
        ],
    )
    await _patch_game_props_deps(monkeypatch, today)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert res.categories == []


def test_route_game_props_404(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    async def boom(**_kwargs):
        raise LookupError("missing")

    monkeypatch.setattr(gp, "get_wnba_props_for_game", boom)
    # Prefer patching the route module binding if the route imported the symbol:
    import app.domains.wnba.routes as routes

    monkeypatch.setattr(routes, "get_wnba_props_for_game", boom)
    res = client.get("/api/wnba/props/game/999999?app=prizepicks")
    assert res.status_code == 404
    assert res.json()["detail"] == "Game not found"


def test_route_game_props_422_bad_app():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.get("/api/wnba/props/game/401770001?app=notabook")
    assert res.status_code == 422


