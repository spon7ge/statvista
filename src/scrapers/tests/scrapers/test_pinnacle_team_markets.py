"""Unit tests for Pinnacle team market extraction from Arcadia payloads."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "pinnacle.py"
_FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "fixtures"
    / "pinnacle_wnba_arcadia_team_lines.json"
)


def _load_scraper():
    spec = importlib.util.spec_from_file_location("pinnacle", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pinnacle"] = mod
    spec.loader.exec_module(mod)
    return mod


pin = _load_scraper()


class TestTeamMarketsFromArcadia:
    def test_extracts_ml_spread_total_from_straight_odds(self) -> None:
        fixture = json.loads(_FIXTURE.read_text())
        scraper = pin.PinnacleScraper("wnba")
        # Slug order is often wrong vs Arcadia home/away; related matchup should win.
        tm = scraper.team_markets_from_arcadia_arrays(
            fixture["straight"],
            fixture["related"],
            "1633005317",
            ["Las Vegas Aces", "Atlanta Dream"],
        )

        assert len(tm["moneyline"]) >= 1
        assert len(tm["spread"]) >= 1
        assert len(tm["total"]) >= 1

        ml = next(x for x in tm["moneyline"] if not x.get("is_alternate"))
        assert ml["period"] == 0
        sides = {line["side"]: line for line in ml["lines"]}
        assert sides["home"]["team"] == "Atlanta Dream"
        assert sides["away"]["team"] == "Las Vegas Aces"
        assert sides["home"]["american"] == -134
        assert sides["away"]["american"] == 111

        spread = next(x for x in tm["spread"] if not x.get("is_alternate"))
        assert {line["side"] for line in spread["lines"]} == {"home", "away"}
        assert any(line.get("points") == -1.5 for line in spread["lines"])

        total = next(x for x in tm["total"] if not x.get("is_alternate"))
        sides_t = {line["side"]: line for line in total["lines"]}
        assert sides_t["over"]["points"] == 186.0
        assert sides_t["under"]["points"] == 186.0

    def test_ignores_player_prop_totals_with_other_matchup_ids(self) -> None:
        fixture = json.loads(_FIXTURE.read_text())
        scraper = pin.PinnacleScraper("wnba")
        tm = scraper.team_markets_from_arcadia_arrays(
            fixture["straight"],
            fixture["related"],
            "1633005317",
            [],
        )
        # Fixture includes one prop total with a different matchupId; only game totals.
        assert all(
            abs(line.get("points", 0) - 186.0) < 20 or line.get("side") in ("over", "under")
            for block in tm["total"]
            for line in block["lines"]
        )
        # All totals in fixture for this game are around 186; prop totals use other ids.
        assert len(tm["total"]) == 2  # main + one alternate in fixture
