from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

JsonMapping = Mapping[str, Any]
PICK6_MLB_URL = "https://pick6.draftkings.com/?sport=MLB"

def _nested_value(record: JsonMapping, path: tuple[str, ...]) -> Any:
    value: Any = record
    for part in path:
        if not isinstance(value, Mapping) or part not in value:
            return None
        value = value[part]
    return value

def _first_value(record: JsonMapping, paths: Iterable[tuple[str, ...]]) -> Any:
    for path in paths:
        value = _nested_value(record, path)
        if value is not None and value != "":
            return value
    return None

def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None

def _number(value: Any) -> int | float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        try:
            parsed = float(value.strip())
        except ValueError:
            return None
        return int(parsed) if parsed.is_integer() else parsed
    return None

def _league_name(record: JsonMapping) -> str | None:
    return _text(
        _first_value(
            record,
            (
                ("league", "name"),
                ("league", "abbreviation"),
                ("leagueName",),
                ("leagueAbbreviation",),
                ("league",),
                ("sport", "league"),
            ),
        )
    )

def normalize_projection(
    record: JsonMapping,
    source_url: str,
    league_hint: str | None = None,
) -> dict[str, Any] | None:
    league = _league_name(record) or league_hint
    if league is None or "mlb" not in league.casefold():
        return None

    player = _text(
        _first_value(
            record,
            (
                ("athlete", "name"),
                ("player", "name"),
                ("participant", "name"),
                ("playerName",),
                ("athleteName",),
                ("participantName",),
                ("name",),
            ),
        )
    )

    stat = _text(
        _first_value(
            record,
            (
                ("statType", "name"),
                ("market", "name"),
                ("category", "name"),
                ("statName",),
                ("statType",),
                ("marketName",),
            ),
        )
    )

    line = _number(
        _first_value(
            record,
            (
                ("projectionValue",),
                ("projection",),
                ("line",),
                ("value",),
                ("points",),
            ),
        )
    )

    if player is None or stat is None or line is None:
        return None

    return {
        "player": player,
        "team": _text(
            _first_value(
                record,
                (
                    ("team", "abbreviation"),
                    ("team", "name"),
                    ("teamAbbreviation",),
                    ("teamName",),
                ),
            )
        ),
        "opponent": _text(
            _first_value(
                record,
                (
                    ("opponent", "abbreviation"),
                    ("opponent", "name"),
                    ("opponentAbbreviation",),
                    ("opponentName",),
                ),
            )
        ),
        "stat": stat,
        "line": line,
        "game_time": _text(
            _first_value(
                record,
                (
                    ("startTime",),
                    ("gameTime",),
                    ("scheduledStart",),
                    ("event", "startTime"),
                ),
            )
        ),
        "source_url": source_url,
    }

def _walk_mappings(
    value: Any,
    league_hint: str | None = None,
) -> Iterable[tuple[JsonMapping, str | None]]:
    if isinstance(value, Mapping):
        current_league = _league_name(value) or league_hint
        yield value, current_league

        for child in value.values():
            yield from _walk_mappings(child, current_league)

    elif isinstance(value, list):
        for child in value:
            yield from _walk_mappings(child, league_hint)

def extract_mlb_projections(
    payload: Any,
    source_url: str,
    league_hint: str | None = None,
) -> list[dict[str, Any]]:
    unique: dict[tuple[Any, ...], dict[str, Any]] = {}

    for record, record_league_hint in _walk_mappings(payload, league_hint):
        projection = normalize_projection(
            record,
            source_url,
            record_league_hint,
        )

        if projection is None:
            continue

        key = (
            projection["player"],
            projection["team"],
            projection["opponent"],
            projection["stat"],
            projection["line"],
            projection["game_time"],
        )
        unique.setdefault(key, projection)

    return sorted(
        unique.values(),
        key=lambda item: (
            item["game_time"] or "",
            item["player"].casefold(),
            item["stat"].casefold(),
            item["line"],
        ),
    )

def merge_response_payloads(
    responses: Iterable[tuple[str, Any]],
    league_hint: str | None = None,
) -> list[dict[str, Any]]:
    unique: dict[tuple[Any, ...], dict[str, Any]] = {}

    for source_url, payload in responses:
        projections = extract_mlb_projections(
            payload,
            source_url,
            league_hint,
        )

        for projection in projections:
            key = (
                projection["player"],
                projection["team"],
                projection["opponent"],
                projection["stat"],
                projection["line"],
                projection["game_time"],
            )
            unique.setdefault(key, projection)

    return sorted(
        unique.values(),
        key=lambda item: (
            item["game_time"] or "",
            item["player"].casefold(),
            item["stat"].casefold(),
            item["line"],
        ),
    )

def write_output(path: Path, projections: list[dict[str, Any]]) -> None:
    document = {
        "sport": "MLB",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(projections),
        "projections": projections,
    }

    path.write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

def write_debug_output(
    path: Path,
    responses: Iterable[tuple[str, Any]],
) -> None:
    response_list = list(responses)

    document = {
        "page_url": PICK6_MLB_URL,
        "response_count": len(response_list),
        "responses": [
            {
                "url": source_url,
                "payload": payload,
            }
            for source_url, payload in response_list
        ],
    }

    path.write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

def _capture_json_response(
    response: Any,
    captured: list[tuple[str, Any]],
) -> None:
    try:
        captured.append((response.url, response.json()))
    except Exception:
        return

def _blocking_message(body_text: str) -> str | None:
    normalized_text = body_text.casefold()

    blocked_messages = (
        "access denied",
        "verify you are human",
        "complete the captcha",
        "unavailable in your location",
    )

    return next(
        (message for message in blocked_messages if message in normalized_text),
        None,
    )

def _load_all_mlb_responses(page: Any, timeout_ms: int) -> None:
    page.goto(
        PICK6_MLB_URL,
        wait_until="domcontentloaded",
        timeout=timeout_ms,
    )
    page.wait_for_timeout(3_000)

    body_text = page.locator("body").inner_text(timeout=10_000)
    blocking_message = _blocking_message(body_text)

    if blocking_message is not None:
        raise RuntimeError(
            "DraftKings presented a blocking page containing "
            f"{blocking_message!r}. The scraper will not bypass it."
        )

    mlb_selector = page.get_by_text("MLB", exact=True)
    if mlb_selector.count() > 0:
        try:
            mlb_selector.first.click(timeout=5_000)
            page.wait_for_timeout(2_000)
        except Exception:
            pass

    for _ in range(8):
        page.mouse.wheel(0, 1_500)
        page.wait_for_timeout(400)

def scrape_pick6(
    *,
    headless: bool = True,
    timeout_ms: int = 45_000,
    debug_output: Path | None = None,
) -> list[dict[str, Any]]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError(
            "Playwright is required. Install it with "
            "`python3 -m pip install playwright`, then run "
            "`python3 -m playwright install chromium`."
        ) from error

    captured: list[tuple[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )

        page = context.new_page()
        page.on(
            "response",
            lambda response: _capture_json_response(response, captured),
        )

        try:
            _load_all_mlb_responses(page, timeout_ms)
        finally:
            browser.close()

    projections = merge_response_payloads(
        captured,
        league_hint="MLB",
    )

    if not projections and debug_output is not None:
        write_debug_output(debug_output, captured)

    return projections

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Save publicly visible DraftKings Pick6 MLB projections as JSON."
        )
    )

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("pick6_mlb_props.json"),
        help="output JSON path (default: pick6_mlb_props.json)",
    )

    parser.add_argument(
        "--headed",
        action="store_false",
        dest="headless",
        help="show the browser window while scraping",
    )

    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=45_000,
        help="page navigation timeout in milliseconds (default: 45000)",
    )

    parser.add_argument(
        "--debug-output",
        type=Path,
        default=Path("pick6_debug.json"),
        help="raw JSON response dump used when no projections are found",
    )

    parser.set_defaults(headless=True)
    return parser

def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)

    try:
        projections = scrape_pick6(
            headless=arguments.headless,
            timeout_ms=arguments.timeout_ms,
            debug_output=arguments.debug_output,
        )
    except Exception as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if not projections:
        print(
            "error: no MLB projections were found in public Pick6 responses. "
            f"Captured responses were saved to {arguments.debug_output}.",
            file=sys.stderr,
        )
        return 2

    write_output(arguments.output, projections)
    print(f"Wrote {len(projections)} MLB projections to {arguments.output}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

