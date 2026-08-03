"""Unit tests for Pinnacle matchup URL discovery helpers (no live browser)."""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "pinnacle.py"
_LEAGUE_FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "fixtures"
    / "pinnacle_wnba_league_matchups.json"
)


def _load_scraper():
    spec = importlib.util.spec_from_file_location("pinnacle", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["pinnacle"] = mod
    spec.loader.exec_module(mod)
    return mod


pin = _load_scraper()


def test_props_and_team_filenames() -> None:
    now = datetime(2026, 8, 3, 12, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert pin._pinnacle_output_filename("wnba", now, kind="props").endswith("_props.json")
    assert pin._pinnacle_output_filename("wnba", now, kind="team").endswith("_team.json")
    assert (
        pin._pinnacle_output_filename("wnba", now, kind="props")
        == "pinnacle_wnba_2026-08-03_120000_props.json"
    )
    assert (
        pin._pinnacle_output_filename("wnba", now, kind="team")
        == "pinnacle_wnba_2026-08-03_120000_team.json"
    )


class TestGameUrlsFromLeagueMatchups:
    def test_builds_urls_from_arcadia_league_matchups(self) -> None:
        rows = json.loads(_LEAGUE_FIXTURE.read_text())
        urls = pin.game_urls_from_league_matchups(rows, "wnba")
        assert urls == [
            "https://www.pinnacle.com/en/basketball/wnba/las-vegas-aces-vs-atlanta-dream/1633005317/#all",
            "https://www.pinnacle.com/en/basketball/wnba/phoenix-mercury-vs-chicago-sky/1633005969/#all",
            "https://www.pinnacle.com/en/basketball/wnba/seattle-storm-vs-new-york-liberty/1633006053/#all",
        ]

    def test_skips_specials_and_child_matchups(self) -> None:
        rows = [
            {
                "type": "matchup",
                "id": 1,
                "parentId": 99,
                "participants": [
                    {"alignment": "away", "name": "A"},
                    {"alignment": "home", "name": "B"},
                ],
            },
            {
                "type": "special",
                "id": 2,
                "parentId": None,
                "participants": [
                    {"alignment": "neutral", "name": "Over"},
                    {"alignment": "neutral", "name": "Under"},
                ],
            },
        ]
        assert pin.game_urls_from_league_matchups(rows, "wnba") == []


class TestCollectGameUrls:
    def test_collects_wnba_matchups_from_hrefs(self) -> None:
        hrefs = [
            "https://www.pinnacle.com/en/basketball/leagues/",
            "https://www.pinnacle.com/en/basketball/wnba/las-vegas-aces-vs-atlanta-dream/1633005317/",
            "https://www.pinnacle.com/en/basketball/wnba/seattle-storm-vs-new-york-liberty/1633006053/",
            "https://www.pinnacle.com/en/basketball/wnba/phoenix-mercury-vs-chicago-sky/1633005969/",
            "https://www.pinnacle.com/en/basketball/wnba/matchups/#all",
        ]
        urls = pin.collect_game_urls(hrefs, "", "wnba")
        assert urls == [
            "https://www.pinnacle.com/en/basketball/wnba/las-vegas-aces-vs-atlanta-dream/1633005317/#all",
            "https://www.pinnacle.com/en/basketball/wnba/phoenix-mercury-vs-chicago-sky/1633005969/#all",
            "https://www.pinnacle.com/en/basketball/wnba/seattle-storm-vs-new-york-liberty/1633006053/#all",
        ]

    def test_falls_back_to_page_source_when_hrefs_empty(self) -> None:
        src = """
        <a href="/en/basketball/wnba/las-vegas-aces-vs-atlanta-dream/1633005317/">Aces</a>
        <a href="/en/basketball/nba/foo-vs-bar/1/">NBA ignored</a>
        """
        urls = pin.collect_game_urls([], src, "wnba")
        assert urls == [
            "https://www.pinnacle.com/en/basketball/wnba/las-vegas-aces-vs-atlanta-dream/1633005317/#all",
        ]

    def test_ignores_other_league(self) -> None:
        hrefs = [
            "https://www.pinnacle.com/en/basketball/nba/lakers-vs-celtics/99/",
        ]
        assert pin.collect_game_urls(hrefs, "", "wnba") == []


class TestRunDbExit:
    def test_run_returns_db_ok_false_when_supabase_fails(self, monkeypatch, tmp_path) -> None:
        scraper = pin.PinnacleScraper("wnba")
        scraper.output_path = str(tmp_path / "out_props.json")

        class _FakeDriver:
            def quit(self) -> None:
                return None

        monkeypatch.setattr(scraper, "_build_driver", lambda discovery=False: _FakeDriver())
        monkeypatch.setattr(scraper, "discover_game_urls", lambda driver: [])

        def _fail_props(*_args, **_kwargs):
            raise RuntimeError("supabase down")

        monkeypatch.setattr(
            "src.odds.load_snapshots.load_pinnacle_props_snapshot",
            _fail_props,
        )

        payload, db_ok = scraper.run()
        assert isinstance(payload, dict)
        assert payload.get("league") == "wnba"
        assert db_ok is False
        assert (tmp_path / "out_props.json").is_file()

    def test_run_all_propagates_db_ok(self, monkeypatch, tmp_path) -> None:
        monkeypatch.setenv("PINNACLE_LEAGUES", "wnba")

        class _FakeScraper:
            def __init__(self, league: str, multi_league_run: bool = False) -> None:
                self.league = league

            def run(self) -> tuple[dict, bool]:
                return {"league": self.league}, False

        monkeypatch.setattr(pin, "PinnacleScraper", _FakeScraper)
        results, db_ok = pin.run_all()
        assert results["wnba"]["league"] == "wnba"
        assert db_ok is False
