"""Unit tests for Pick6 MLB export shape (no live network)."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "mlb_pick6_scraper.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("mlb_pick6_scraper", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mlb_pick6_scraper"] = mod
    spec.loader.exec_module(mod)
    return mod


pk = _load_scraper()

_PRIZEPICKS_ROW_KEYS = {
    "player",
    "stat_type",
    "line_score",
    "odds_type",
    "updated_at",
    "league",
}


def test_normalize_projection_matches_prizepicks_row() -> None:
    row = pk.normalize_projection(
        {
            "league": {"name": "MLB"},
            "player": {"name": "Aaron Judge"},
            "statType": {"name": "Home Runs"},
            "line": 0.5,
            "oddsType": "standard",
            "updatedAt": "2026-08-29T12:00:00-04:00",
        },
        "https://pick6.draftkings.com/",
    )
    assert row is not None
    assert set(row) == _PRIZEPICKS_ROW_KEYS
    assert row["player"] == "Aaron Judge"
    assert row["stat_type"] == "Home Runs"
    assert row["line_score"] == 0.5
    assert row["odds_type"] == "standard"
    assert row["updated_at"] == "2026-08-29T12:00:00-04:00"
    assert row["league"] == "MLB"


def test_normalize_projection_defaults_odds_type_to_standard() -> None:
    row = pk.normalize_projection(
        {
            "leagueName": "MLB",
            "playerName": "Shohei Ohtani",
            "statName": "Hits",
            "projectionValue": 1.5,
        },
        "https://example.test/api",
    )
    assert row is not None
    assert row["odds_type"] == "standard"
    assert row["updated_at"] == ""


def test_write_output_matches_prizepicks_envelope(tmp_path: Path) -> None:
    path = tmp_path / "pick6.json"
    pk.write_output(
        path,
        [
            {
                "player": "Aaron Judge",
                "stat_type": "Home Runs",
                "line_score": 0.5,
                "odds_type": "standard",
                "updated_at": "",
                "league": "MLB",
            }
        ],
    )
    document = json.loads(path.read_text(encoding="utf-8"))
    assert set(document) == {
        "source",
        "league",
        "fetched_at",
        "raw_snapshot",
        "count",
        "projections",
    }
    assert document["source"] == "DraftKings Pick6"
    assert document["league"] == "MLB"
    assert document["raw_snapshot"] is None
    assert document["count"] == 1
    assert document["fetched_at"].endswith("Z")
    row = document["projections"][0]
    assert set(row) == _PRIZEPICKS_ROW_KEYS
    assert row["updated_at"] == document["fetched_at"]


def _remix_encode(value: object) -> list[object]:
    nodes: list[object] = []

    def intern(item: object) -> int:
        if item is None:
            return -1
        if isinstance(item, dict):
            index = len(nodes)
            nodes.append({})
            encoded = {
                f"_{intern(str(key))}": intern(child) for key, child in item.items()
            }
            nodes[index] = encoded
            return index
        if isinstance(item, list):
            index = len(nodes)
            nodes.append([])
            nodes[index] = [intern(child) for child in item]
            return index
        nodes.append(item)
        return len(nodes) - 1

    intern(value)
    return nodes


_PICK_BUNDLE = {
    "pickCardByPickableId": {
        "1": {
            "entities": [{"dkId": 99}],
            "activePickableMarkets": [
                {
                    "targetValue": 1.5,
                    "pickSixMarketId": 7,
                    "promoPickTypeId": 1,
                },
                {
                    "targetValue": 2.5,
                    "pickSixMarketId": 7,
                    "promoPickTypeId": 4,
                },
            ],
        }
    },
    "entityInfoByDkId": {"99": {"fullName": "Aaron Judge"}},
    "pickSixMarketById": {"7": {"name": "Hits"}},
}


def test_remix_inflate_round_trip() -> None:
    nested = {"player": "Aaron Judge", "lines": [1.5, None], "flag": True}
    assert pk.remix_inflate(_remix_encode(nested)) == nested


def test_extract_mlb_projections_from_remix_bundle() -> None:
    rows = pk.extract_mlb_projections(
        _remix_encode(_PICK_BUNDLE),
        "https://pick6.draftkings.com/category/10.data?sport=MLB",
    )
    assert rows == [
        {
            "player": "Aaron Judge",
            "stat_type": "Hits",
            "line_score": 1.5,
            "odds_type": "standard",
            "updated_at": "",
            "league": "MLB",
        },
        {
            "player": "Aaron Judge",
            "stat_type": "Hits",
            "line_score": 2.5,
            "odds_type": "demon",
            "updated_at": "",
            "league": "MLB",
        },
    ]


def test_extract_mlb_projections_skips_non_mlb_sport_url() -> None:
    rows = pk.extract_mlb_projections(
        _remix_encode(_PICK_BUNDLE),
        "https://pick6.draftkings.com/category/10.data?sport=NBA",
    )
    assert rows == []


def test_capture_json_response_accepts_remix_data_without_json_content_type() -> None:
    captured: list[tuple[str, object]] = []
    payload = _remix_encode(_PICK_BUNDLE)
    url = "https://pick6.draftkings.com/category/10.data?sport=MLB"

    class _Response:
        def __init__(self) -> None:
            self.url = url
            self.headers = {"content-type": "text/x-script; charset=utf-8"}

        def json(self) -> object:
            raise ValueError("not json")

        def text(self) -> str:
            return json.dumps(payload)

    pk._capture_json_response(_Response(), captured)
    assert captured == [(url, payload)]
    assert pk.merge_response_payloads(captured)[0]["player"] == "Aaron Judge"
