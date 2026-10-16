"""Pinnacle NFL player props scraper via Selenium.

Scrapes NFL player props and team markets from Pinnacle's Arcadia responses.

Requirements:
    Google Chrome
    selenium

Useful environment variables:
    PINNACLE_CHROME_VISIBLE=1
    PINNACLE_MAX_GAMES=50
    PINNACLE_WORKERS=4
    PINNACLE_SKIP_DB=1
    PINNACLE_NFL_ARCADIA_ID=889
    PINNACLE_OUTPUT=/path/to/output.json
    PINNACLE_OUTPUT_DIR=/path/to/directory
"""

from __future__ import annotations

import base64
import datetime as dt
import json
import logging
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.wait import WebDriverWait
except ImportError:
    By = EC = WebDriverWait = None  # type: ignore[assignment]

sys.path.insert(0, _ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(_ROOT, ".env"))

logger = logging.getLogger(__name__)

PINNACLE_ORIGIN = "https://www.pinnacle.com"

NFL_MATCHUPS_URL = (
    "https://www.pinnacle.com/en/football/nfl/matchups/#all"
)

NFL_ARCADIA_ID = int(
    os.environ.get(
        "PINNACLE_NFL_ARCADIA_ID",
        "889",
    )
)

_DEFAULT_OUTPUT_DIR = os.path.join(
    _ROOT,
    "data",
    "props",
    "pinnacle",
    "nfl",
)

_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")

TEAM_MARKET_TYPES = (
    "moneyline",
    "spread",
    "total",
)

PLAYER_PROP_UNITS: dict[str, str] = {
    "Passing Yards": "passing_yards",
    "Pass Yards": "passing_yards",
    "Passing Touchdowns": "passing_touchdowns",
    "Passing TDs": "passing_touchdowns",
    "Pass Completions": "passing_completions",
    "Passing Completions": "passing_completions",
    "Completions": "passing_completions",
    "Pass Attempts": "passing_attempts",
    "Passing Attempts": "passing_attempts",
    "Interceptions": "interceptions",
    "Interceptions Thrown": "interceptions",
    "Rushing Yards": "rushing_yards",
    "Rush Yards": "rushing_yards",
    "Rushing Attempts": "rushing_attempts",
    "Rush Attempts": "rushing_attempts",
    "Receiving Yards": "receiving_yards",
    "Receptions": "receptions",
    "Rushing And Receiving Yards": "rushing_receiving_yards",
    "Rushing & Receiving Yards": "rushing_receiving_yards",
    "Rushing + Receiving Yards": "rushing_receiving_yards",
    "Longest Completion": "longest_completion",
    "Longest Pass Completion": "longest_completion",
    "Longest Reception": "longest_reception",
    "Longest Rush": "longest_rush",
    "Touchdowns": "touchdowns",
    "Passing And Rushing Touchdowns": "passing_rushing_touchdowns",
    "Receiving Touchdowns": "receiving_touchdowns",
    "Rushing Touchdowns": "rushing_touchdowns",
    "Kicking Points": "kicking_points",
    "Field Goals": "field_goals_made",
    "Field Goals Made": "field_goals_made",
    "Extra Points": "extra_points_made",
    "Extra Points Made": "extra_points_made",
    "PATs Made": "extra_points_made",
    "Longest Field Goal": "longest_field_goal",
    "Sacks": "sacks",
    "Tackles": "tackles",
    "Tackles And Assists": "tackles_assists",
    "Tackles + Assists": "tackles_assists",
}

_PROP_NAME_SUFFIXES = tuple(
    sorted(
        PLAYER_PROP_UNITS,
        key=len,
        reverse=True,
    )
)

_GAME_PATH_RE = re.compile(
    r"/en/football/(?P<league>nfl)/"
    r"(?P<slug>[\w.-]+)/(?P<mid>\d+)/?",
    re.IGNORECASE,
)

def _env_enabled(name: str) -> bool:
    return os.environ.get(
        name,
        "",
    ).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

def output_filename(
    now: dt.datetime | None = None,
    *,
    kind: str = "props",
) -> str:
    if kind not in ("props", "team"):
        raise ValueError(
            f"kind must be 'props' or 'team', got {kind!r}"
        )

    if now is None:
        value = dt.datetime.now(_OUTPUT_TZ)
    elif now.tzinfo is None:
        value = now.replace(
            tzinfo=dt.timezone.utc
        ).astimezone(_OUTPUT_TZ)
    else:
        value = now.astimezone(_OUTPUT_TZ)

    return value.strftime(
        f"pinnacle_nfl_%Y-%m-%d_%H%M%S_{kind}.json"
    )

def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return (
            props_path[: -len("_props.json")]
            + "_team.json"
        )

    base, extension = os.path.splitext(
        props_path
    )

    return f"{base}_team{extension or '.json'}"

def resolve_output_path() -> str:
    output = os.environ.get(
        "PINNACLE_OUTPUT",
        "",
    ).strip()

    output_dir = os.environ.get(
        "PINNACLE_OUTPUT_DIR",
        "",
    ).strip()

    filename = output_filename(kind="props")

    if output:
        expanded = os.path.expanduser(output)

        if (
            expanded.lower().endswith(".json")
            and not os.path.isdir(expanded)
        ):
            return expanded

        os.makedirs(expanded, exist_ok=True)
        return os.path.join(
            expanded,
            filename,
        )

    directory = (
        os.path.expanduser(output_dir)
        if output_dir
        else _DEFAULT_OUTPUT_DIR
    )

    os.makedirs(directory, exist_ok=True)

    return os.path.join(
        directory,
        filename,
    )

def props_payload(
    base: dict[str, Any],
    games: list[dict[str, Any]],
) -> dict[str, Any]:
    props_games = [
        {
            key: value
            for key, value in game.items()
            if key != "team_markets"
        }
        for game in games
    ]

    return {
        **base,
        "snapshot_kind": "props",
        "games": props_games,
    }

def team_payload(
    base: dict[str, Any],
    games: list[dict[str, Any]],
) -> dict[str, Any]:
    team_games = [
        {
            key: value
            for key, value in game.items()
            if key != "props"
        }
        for game in games
    ]

    return {
        **base,
        "snapshot_kind": "team",
        "games": team_games,
    }

def convert_american_odds(
    american_odds: list[float],
) -> list[float]:
    decimal_odds: list[float] = []

    for odd in american_odds:
        if odd >= 0:
            decimal_odds.append(
                round(odd / 100 + 1, 3)
            )
        else:
            decimal_odds.append(
                round(-100 / odd + 1, 3)
            )

    return decimal_odds

def american_display(
    value: float | int,
) -> int | float:
    number = float(value)

    if abs(number - round(number)) < 1e-6:
        return int(round(number))

    return number

def get_odds_from_market_id(
    market_id: int | str,
    all_odds: list[dict[str, Any]],
) -> tuple[list[float], float, list[float]]:
    for odds_row in all_odds:
        try:
            row_matchup_id = int(
                odds_row.get("matchupId")
            )
        except (TypeError, ValueError):
            continue

        if not (
            row_matchup_id == int(market_id)
            and odds_row.get("type") == "total"
            and odds_row.get("period") == 0
        ):
            continue

        prices = odds_row.get("prices") or []

        if len(prices) < 2:
            continue

        valid_prices = [
            price
            for price in prices
            if (
                isinstance(price, dict)
                and price.get("price") is not None
                and price.get("points") is not None
                and price.get("participantId") is not None
            )
        ]

        if len(valid_prices) < 2:
            continue

        ordered = sorted(
            valid_prices,
            key=lambda price: price["participantId"],
        )

        american = [
            float(price["price"])
            for price in ordered
        ]

        decimals = convert_american_odds(
            american
        )

        return (
            decimals,
            float(ordered[0]["points"]),
            american,
        )

    return [], 0.0, []

def clean_player_name(
    description: str,
) -> str:
    player = (
        description or ""
    ).split("(")[0].strip()

    if not player:
        return player

    legacy = re.search(
        r"(?is)total\s+points\s+by\s+(.+)$",
        player,
    )

    if legacy:
        return legacy.group(1).strip()

    first_total = re.search(
        r"(?is)\s+total\s+",
        player,
    )

    if first_total:
        return player[
            : first_total.start()
        ].strip()

    lower_player = player.lower()

    for suffix in _PROP_NAME_SUFFIXES:
        suffix_lower = suffix.lower()

        if lower_player.endswith(
            f" {suffix_lower}"
        ):
            return player[
                : -(len(suffix) + 1)
            ].strip()

    return player

def matchup_url_parts(
    raw: str,
) -> tuple[str, str | None, str | None]:
    match = _GAME_PATH_RE.search(raw)

    if not match:
        return "", None, None

    return (
        match.group("mid"),
        match.group("slug"),
        match.group("league").lower(),
    )

def participants_from_slug(
    slug: str | None,
) -> list[str]:
    if (
        not slug
        or "-vs-" not in slug.lower()
    ):
        return []

    first, second = re.split(
        r"-vs-",
        slug,
        maxsplit=1,
        flags=re.IGNORECASE,
    )

    return [
        participant.replace(
            "-",
            " ",
        ).title()
        for participant in (first, second)
    ]

def normalize_game_url(
    url: str,
) -> str | None:
    matchup_id, slug, league = (
        matchup_url_parts(url)
    )

    if (
        not matchup_id
        or not slug
        or league != "nfl"
    ):
        return None

    if "/matchups" in urlparse(
        url.lower()
    ).path:
        return None

    return urljoin(
        PINNACLE_ORIGIN,
        (
            f"/en/football/nfl/{slug}/"
            f"{matchup_id}/#all"
        ),
    )

def collect_game_urls(
    hrefs: list[str],
    page_source: str,
) -> list[str]:
    candidates: set[str] = set()

    for raw in hrefs:
        raw = (raw or "").strip()

        if (
            not raw
            or "football/nfl/" not in raw.lower()
        ):
            continue

        canonical = normalize_game_url(raw)

        if canonical:
            candidates.add(canonical)

    if not candidates:
        for match in _GAME_PATH_RE.finditer(
            page_source or ""
        ):
            fragment = match.group(0)

            canonical = normalize_game_url(
                urljoin(
                    PINNACLE_ORIGIN,
                    fragment,
                )
            )

            if canonical:
                candidates.add(canonical)

    return sorted(candidates)

def slugify_team_name(name: str) -> str:
    value = re.sub(
        r"[^a-z0-9]+",
        "-",
        (name or "").lower().strip(),
    )

    return value.strip("-")

def slug_from_matchup_participants(
    participants: list[Any],
) -> str | None:
    by_alignment: dict[str, str] = {}

    for participant in participants or []:
        if not isinstance(participant, dict):
            continue

        alignment = participant.get(
            "alignment"
        )

        name = participant.get("name")

        if (
            alignment in ("home", "away")
            and name
        ):
            by_alignment[str(alignment)] = str(
                name
            )

    if (
        "away" not in by_alignment
        or "home" not in by_alignment
    ):
        return None

    away = slugify_team_name(
        by_alignment["away"]
    )

    home = slugify_team_name(
        by_alignment["home"]
    )

    return f"{away}-vs-{home}"

def game_urls_from_league_matchups(
    rows: list[Any],
) -> list[str]:
    candidates: set[str] = set()

    for row in rows or []:
        if not isinstance(row, dict):
            continue

        if row.get("type") != "matchup":
            continue

        if row.get("parentId") is not None:
            continue

        matchup_id = row.get("id")

        if matchup_id is None:
            continue

        slug = slug_from_matchup_participants(
            row.get("participants") or []
        )

        if not slug:
            continue

        canonical = normalize_game_url(
            urljoin(
                PINNACLE_ORIGIN,
                (
                    f"/en/football/nfl/{slug}/"
                    f"{matchup_id}/"
                ),
            )
        )

        if canonical:
            candidates.add(canonical)

    return sorted(candidates)

def worker_scrape_batch(
    worker_id: int,
    batch: list[tuple[int, str]],
) -> list[tuple[int, dict[str, Any]]]:
    if not batch:
        return []

    scraper = PinnacleScraper()

    driver = scraper.build_driver(
        worker_id=worker_id,
        discovery=False,
    )

    output: list[
        tuple[int, dict[str, Any]]
    ] = []

    try:
        for position, (
            index,
            url,
        ) in enumerate(batch, start=1):
            print(
                f"  [worker {worker_id + 1} "
                f"{position}/{len(batch)}] {url}"
            )

            try:
                game = (
                    scraper.scrape_matchup(
                        driver,
                        url,
                    )
                )

                output.append(
                    (index, game)
                )

            except Exception as exc:
                print(
                    f"    skip "
                    f"(w{worker_id + 1}): {exc}"
                )

                matchup_id, slug, _ = (
                    matchup_url_parts(url)
                )

                output.append(
                    (
                        index,
                        {
                            "matchup_id": (
                                int(matchup_id)
                                if matchup_id
                                else None
                            ),
                            "source_url": url,
                            "slug": slug,
                            "error": str(exc),
                            "props": [],
                            "team_markets": {},
                            "league": "NFL",
                        },
                    )
                )

    finally:
        driver.quit()

    return output

class PinnacleScraper:
    def __init__(self) -> None:
        self.league = "nfl"
        self.matchups_url = NFL_MATCHUPS_URL
        self.output_path = resolve_output_path()

        odds_format = os.environ.get(
            "PINNACLE_ODDS_FORMAT",
            "both",
        ).strip().lower()

        self.odds_format = (
            odds_format
            if odds_format
            in ("both", "decimal", "american")
            else "both"
        )

        self.page_wait = float(
            os.environ.get(
                "PINNACLE_PAGE_WAIT",
                "8",
            )
        )

        self.max_games = int(
            os.environ.get(
                "PINNACLE_MAX_GAMES",
                "50",
            )
        )

        cpu_count = os.cpu_count() or 8
        default_workers = min(
            6,
            max(2, cpu_count // 2),
        )

        try:
            self.parallel_workers = max(
                1,
                int(
                    os.environ.get(
                        "PINNACLE_WORKERS",
                        str(default_workers),
                    )
                ),
            )
        except ValueError:
            self.parallel_workers = 1

        self.arcadia_timeout = float(
            os.environ.get(
                "PINNACLE_ARCADIA_TIMEOUT",
                "90",
            )
        )

        self.arcadia_poll = float(
            os.environ.get(
                "PINNACLE_ARCADIA_POLL",
                "0.22",
            )
        )

        self.post_arcadia_buffer = float(
            os.environ.get(
                "PINNACLE_POST_ARCADIA_BUFFER",
                "0.08",
            )
        )

        self.discover_scroll_rounds = int(
            os.environ.get(
                "PINNACLE_DISCOVER_SCROLL_ROUNDS",
                "8",
            )
        )

        self.discover_scroll_pause = float(
            os.environ.get(
                "PINNACLE_DISCOVER_SCROLL_PAUSE",
                "0.32",
            )
        )

        self.discover_retries = max(
            1,
            int(
                os.environ.get(
                    "PINNACLE_DISCOVER_RETRIES",
                    "3",
                )
            ),
        )

        self.discover_retry_pause = float(
            os.environ.get(
                "PINNACLE_DISCOVER_RETRY_PAUSE",
                "2.5",
            )
        )

        self.discover_settle = float(
            os.environ.get(
                "PINNACLE_DISCOVER_SETTLE",
                "0.65",
            )
        )

        self.discover_wait = float(
            os.environ.get(
                "PINNACLE_DISCOVER_WAIT",
                "20",
            )
        )

        self.games_per_worker = max(
            1,
            int(
                os.environ.get(
                    "PINNACLE_GAMES_PER_WORKER",
                    "2",
                )
            ),
        )

        self.last_effective_parallel: (
            int | None
        ) = None

    def chrome_visible(self) -> bool:
        return _env_enabled(
            "PINNACLE_CHROME_VISIBLE"
        )

    def build_driver(
        self,
        worker_id: int | None = None,
        *,
        discovery: bool,
    ):
        if WebDriverWait is None:
            raise RuntimeError(
                "Install Selenium: pip install selenium"
            )

        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options

        options = Options()

        if (
            not discovery
            and not _env_enabled(
                "PINNACLE_MATCHUP_NORMAL_LOAD"
            )
        ):
            options.page_load_strategy = "eager"

        options.add_argument(
            "--window-size=1400,1000"
        )

        options.add_argument(
            "--disable-extensions"
        )

        options.add_argument(
            "--disable-blink-features="
            "AutomationControlled"
        )

        if not self.chrome_visible():
            options.add_argument(
                "--headless=new"
            )

        options.add_argument("--disable-gpu")
        options.add_argument("--lang=en-US")

        if (
            not discovery
            and _env_enabled(
                "PINNACLE_BLOCK_IMAGES"
            )
        ):
            options.add_experimental_option(
                "prefs",
                {
                    "profile.managed_default_content_"
                    "settings.images": 2
                },
            )

        if worker_id is not None:
            user_data_dir = tempfile.mkdtemp(
                prefix=(
                    "pinnacle_chrome_nfl_"
                    f"w{worker_id}_"
                )
            )

            options.add_argument(
                "--user-data-dir="
                f"{user_data_dir}"
            )

        options.set_capability(
            "goog:loggingPrefs",
            {"performance": "ALL"},
        )

        driver = webdriver.Chrome(
            options=options
        )

        driver.implicitly_wait(0)

        driver.execute_cdp_cmd(
            "Network.enable",
            {},
        )

        driver.set_page_load_timeout(120)

        return driver

    def effective_workers(
        self,
        game_count: int,
    ) -> int:
        if game_count <= 0:
            return 1

        ideal = (
            game_count
            + self.games_per_worker
            - 1
        ) // self.games_per_worker

        return min(
            self.parallel_workers,
            game_count,
            max(1, ideal),
        )

    def scroll_lazy(
        self,
        driver: Any,
        *,
        rounds: int | None = None,
    ) -> None:
        if By is None:
            return

        count = (
            self.discover_scroll_rounds
            if rounds is None
            else rounds
        )

        for _ in range(max(1, count)):
            driver.execute_script(
                "window.scrollBy({"
                "top: window.innerHeight * 0.85,"
                "behavior: 'instant'"
                "})"
            )

            time.sleep(
                self.discover_scroll_pause
            )

    def dismiss_cookie_banner(
        self,
        driver: Any,
    ) -> None:
        if By is None:
            return

        for text in (
            "ACCEPT",
            "Accept",
            "Accept all",
            "I Accept",
        ):
            try:
                elements = driver.find_elements(
                    By.XPATH,
                    (
                        "//*[self::button or self::a "
                        "or @role='button']"
                        "[contains(normalize-space(.), "
                        f"'{text}')]"
                    ),
                )

                for element in elements:
                    if element.is_displayed():
                        element.click()
                        time.sleep(0.35)
                        return

            except Exception:
                continue

    def read_urls_from_driver(
        self,
        driver: Any,
    ) -> list[str]:
        hrefs: list[str] = []

        try:
            for anchor in driver.find_elements(
                By.TAG_NAME,
                "a",
            ):
                hrefs.append(
                    (
                        anchor.get_attribute(
                            "href"
                        )
                        or ""
                    ).strip()
                )
        except Exception:
            hrefs = []

        try:
            source = driver.page_source or ""
        except Exception:
            source = ""

        return collect_game_urls(
            hrefs,
            source,
        )

    def response_body_json(
        self,
        driver: Any,
        request_id: str,
    ) -> Any | None:
        try:
            body = driver.execute_cdp_cmd(
                "Network.getResponseBody",
                {"requestId": request_id},
            )
        except Exception:
            return None

        blob = body.get("body") or ""

        if not blob:
            return None

        if body.get("base64Encoded"):
            try:
                blob = base64.b64decode(
                    blob
                ).decode(
                    "utf-8",
                    errors="replace",
                )
            except Exception:
                return None

        try:
            return json.loads(blob)
        except json.JSONDecodeError:
            return None

    def drain_network_log(
        self,
        driver: Any,
        urls_by_request: dict[str, str],
        finished: dict[str, str],
    ) -> None:
        try:
            entries = driver.get_log(
                "performance"
            )
        except Exception:
            return

        for entry in entries:
            try:
                message = json.loads(
                    entry["message"]
                ).get("message") or {}
            except (
                KeyError,
                TypeError,
                json.JSONDecodeError,
            ):
                continue

            method = message.get("method")
            params = message.get("params") or {}
            request_id = params.get("requestId")

            if not request_id:
                continue

            if method == "Network.requestWillBeSent":
                url = (
                    params.get("request") or {}
                ).get("url") or ""

                if (
                    "guest.api.arcadia.pinnacle.com"
                    in url
                ):
                    urls_by_request[
                        request_id
                    ] = url

            elif method == "Network.responseReceived":
                url = (
                    params.get("response") or {}
                ).get("url") or ""

                if (
                    "guest.api.arcadia.pinnacle.com"
                    in url
                ):
                    urls_by_request[
                        request_id
                    ] = url

            elif method == "Network.loadingFinished":
                url = urls_by_request.get(
                    request_id
                )

                if (
                    url
                    and "guest.api.arcadia.pinnacle.com"
                    in url
                ):
                    finished[request_id] = url

    def league_matchup_urls(
        self,
        driver: Any,
        urls_by_request: dict[str, str],
        finished: dict[str, str],
    ) -> list[str]:
        self.drain_network_log(
            driver,
            urls_by_request,
            finished,
        )

        needle = (
            f"/leagues/{NFL_ARCADIA_ID}/"
            "matchups"
        )

        best: list[Any] = []

        for request_id, url in finished.items():
            path = urlparse(url).path.rstrip(
                "/"
            )

            if needle not in path:
                continue

            if not path.endswith(
                f"/leagues/{NFL_ARCADIA_ID}/"
                "matchups"
            ):
                continue

            data = self.response_body_json(
                driver,
                request_id,
            )

            if isinstance(data, list) and data:
                best = data

        if not best:
            return []

        return game_urls_from_league_matchups(
            best
        )

    def discover_game_urls(
        self,
        driver: Any,
    ) -> list[str]:
        if (
            WebDriverWait is None
            or By is None
            or EC is None
        ):
            raise RuntimeError(
                "Install Selenium: pip install selenium"
            )

        for attempt in range(
            self.discover_retries
        ):
            if attempt > 0:
                print(
                    "[nfl] No game URLs; retrying "
                    f"{attempt + 1}/"
                    f"{self.discover_retries}"
                )

                time.sleep(
                    self.discover_retry_pause
                )

            driver.get(self.matchups_url)

            WebDriverWait(
                driver,
                60,
            ).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "#root")
                )
            )

            self.dismiss_cookie_banner(driver)

            if self.discover_settle > 0:
                time.sleep(
                    self.discover_settle
                )

            self.scroll_lazy(driver)

            urls_by_request: dict[
                str,
                str,
            ] = {}

            finished: dict[str, str] = {}

            deadline = (
                time.time()
                + max(
                    1.0,
                    self.discover_wait,
                )
            )

            while time.time() < deadline:
                urls = self.league_matchup_urls(
                    driver,
                    urls_by_request,
                    finished,
                )

                if not urls:
                    urls = (
                        self.read_urls_from_driver(
                            driver
                        )
                    )

                if urls:
                    return urls[
                        : self.max_games
                    ]

                self.scroll_lazy(
                    driver,
                    rounds=1,
                )

                time.sleep(0.45)

        return []

    def finished_matchup_requests(
        self,
        driver: Any,
        urls_by_request: dict[str, str],
        finished: dict[str, str],
    ) -> dict[str, str]:
        self.drain_network_log(
            driver,
            urls_by_request,
            finished,
        )

        return {
            request_id: url
            for request_id, url
            in finished.items()
            if "/matchups/" in url
        }

    def extract_matchup_arrays(
        self,
        driver: Any,
        matchup_id: str,
        urls_by_request: dict[str, str],
        finished: dict[str, str],
    ) -> tuple[
        list[dict[str, Any]],
        list[dict[str, Any]],
    ]:
        requests_by_id = (
            self.finished_matchup_requests(
                driver,
                urls_by_request,
                finished,
            )
        )

        straight: list[dict[str, Any]] = []
        related: list[dict[str, Any]] = []

        related_path = (
            f"/matchups/{matchup_id}/related"
        )

        straight_path = (
            f"/matchups/{matchup_id}/"
            "markets/related/straight"
        )

        for request_id, url in (
            requests_by_id.items()
        ):
            path = urlparse(url).path.replace(
                "//",
                "/",
            )

            data = self.response_body_json(
                driver,
                request_id,
            )

            if not isinstance(data, list):
                continue

            rows = [
                row
                for row in data
                if isinstance(row, dict)
            ]

            if (
                straight_path in path
                and rows
            ):
                straight = rows
            elif (
                related_path in path
                and rows
            ):
                related = rows

        return straight, related

    def poll_matchup_arrays(
        self,
        driver: Any,
        matchup_id: str,
    ) -> tuple[
        list[dict[str, Any]],
        list[dict[str, Any]],
    ]:
        deadline = (
            time.time()
            + max(
                5.0,
                self.arcadia_timeout,
            )
        )

        urls_by_request: dict[str, str] = {}
        finished: dict[str, str] = {}
        iterations = 0

        while time.time() < deadline:
            straight, related = (
                self.extract_matchup_arrays(
                    driver,
                    matchup_id,
                    urls_by_request,
                    finished,
                )
            )

            if straight and related:
                if (
                    self.post_arcadia_buffer > 0
                ):
                    time.sleep(
                        self.post_arcadia_buffer
                    )

                return straight, related

            time.sleep(
                max(
                    0.1,
                    self.arcadia_poll,
                )
            )

            iterations += 1

            if iterations % 5 == 0:
                driver.execute_script(
                    "window.dispatchEvent("
                    "new Event('resize'));"
                )

        return [], []

    def props_from_arrays(
        self,
        straight: list[dict[str, Any]],
        markets: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []

        for market in markets:
            if market.get("type") != "special":
                continue

            unit = str(
                market.get("units") or ""
            )

            stat = PLAYER_PROP_UNITS.get(
                unit
            )

            if not stat:
                logger.debug(
                    "Skipping unsupported Pinnacle "
                    "NFL prop unit=%r description=%r",
                    unit,
                    (
                        market.get("special")
                        or {}
                    ).get("description"),
                )
                continue

            market_id = market.get("id")

            if market_id is None:
                continue

            special = market.get(
                "special"
            ) or {}

            description = str(
                special.get("description")
                or ""
            )

            player = clean_player_name(
                description
            )

            decimals, line, american = (
                get_odds_from_market_id(
                    market_id,
                    straight,
                )
            )

            if (
                not decimals
                or len(decimals) < 2
            ):
                continue

            row: dict[str, Any] = {
                "stat": stat,
                "player": player,
                "line": line,
                "market_id": market_id,
            }

            if self.odds_format in (
                "both",
                "decimal",
            ):
                row["decimal_over"] = (
                    decimals[0]
                )

                row["decimal_under"] = (
                    decimals[1]
                )

            if self.odds_format in (
                "both",
                "american",
            ):
                row["american_over"] = (
                    american_display(
                        american[0]
                    )
                )

                row["american_under"] = (
                    american_display(
                        american[1]
                    )
                )

            rows.append(row)

        return rows

    def team_markets_from_arrays(
        self,
        straight: list[dict[str, Any]],
        markets: list[dict[str, Any]],
        matchup_id: str,
        participants: list[str],
    ) -> dict[
        str,
        list[dict[str, Any]],
    ]:
        output = {
            market_type: []
            for market_type
            in TEAM_MARKET_TYPES
        }

        try:
            matchup_id_int = int(matchup_id)
        except (TypeError, ValueError):
            return output

        alignment_names: dict[str, str] = {}

        for market in markets:
            if market.get("type") != "matchup":
                continue

            try:
                if (
                    int(market.get("id"))
                    != matchup_id_int
                ):
                    continue
            except (TypeError, ValueError):
                continue

            for participant in (
                market.get("participants")
                or []
            ):
                if not isinstance(
                    participant,
                    dict,
                ):
                    continue

                alignment = participant.get(
                    "alignment"
                )

                name = participant.get("name")

                if alignment and name:
                    alignment_names[
                        str(alignment)
                    ] = str(name)

            break

        for row in straight:
            try:
                if (
                    int(row.get("matchupId"))
                    != matchup_id_int
                ):
                    continue
            except (TypeError, ValueError):
                continue

            market_type = row.get("type")

            if (
                market_type
                not in TEAM_MARKET_TYPES
            ):
                continue

            prices = row.get("prices") or []

            if not prices:
                continue

            period = row.get("period", 0)
            lines: list[dict[str, Any]] = []

            for price in prices:
                if not isinstance(price, dict):
                    continue

                entry: dict[str, Any] = {}

                designation = price.get(
                    "designation"
                )

                if designation:
                    entry["side"] = designation

                    team = alignment_names.get(
                        str(designation)
                    )

                    if team:
                        entry["team"] = team

                participant_id = price.get(
                    "participantId"
                )

                if (
                    "team" not in entry
                    and participant_id is not None
                ):
                    try:
                        index = int(
                            participant_id
                        )
                    except (
                        TypeError,
                        ValueError,
                    ):
                        index = -1

                    if (
                        0 <= index
                        < len(participants)
                    ):
                        entry["team"] = (
                            participants[index]
                        )
                    else:
                        entry[
                            "participant_id"
                        ] = participant_id

                if price.get("points") is not None:
                    entry["points"] = (
                        price["points"]
                    )

                raw_price = price.get("price")

                if raw_price is not None:
                    entry["american"] = (
                        american_display(
                            raw_price
                        )
                    )

                    entry["decimal"] = (
                        convert_american_odds(
                            [float(raw_price)]
                        )[0]
                    )

                lines.append(entry)

            if lines:
                block: dict[str, Any] = {
                    "period": period,
                    "lines": lines,
                }

                if row.get("isAlternate"):
                    block[
                        "is_alternate"
                    ] = True

                output[market_type].append(
                    block
                )

        return output

    def scrape_matchup(
        self,
        driver: Any,
        game_url: str,
    ) -> dict[str, Any]:
        if (
            WebDriverWait is None
            or By is None
            or EC is None
        ):
            raise RuntimeError(
                "Install Selenium: pip install selenium"
            )

        matchup_id, slug, _ = (
            matchup_url_parts(game_url)
        )

        if not matchup_id:
            return {
                "matchup_id": None,
                "source_url": game_url,
                "league": "NFL",
                "start_time": None,
                "label": slug or "",
                "participants": [],
                "props": [],
                "team_markets": {},
            }

        driver.get(game_url)

        WebDriverWait(
            driver,
            90,
        ).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "#root")
            )
        )

        straight, markets = (
            self.poll_matchup_arrays(
                driver,
                matchup_id,
            )
        )

        if not straight or not markets:
            raise RuntimeError(
                "Arcadia matchup responses were "
                "not captured before timeout"
            )

        props = self.props_from_arrays(
            straight,
            markets,
        )

        participants = (
            participants_from_slug(slug)
        )

        label = (
            slug.replace("-", " ")
            .title()
            .replace(" Vs ", " vs ")
            if slug
            else ""
        )

        start_time: str | None = None
        matchup_id_int = int(matchup_id)

        for market in markets:
            if market.get("type") != "matchup":
                continue

            try:
                if (
                    int(market.get("id"))
                    != matchup_id_int
                ):
                    continue
            except (TypeError, ValueError):
                continue

            ordered = sorted(
                [
                    participant
                    for participant
                    in (
                        market.get("participants")
                        or []
                    )
                    if (
                        isinstance(
                            participant,
                            dict,
                        )
                        and participant.get("name")
                    )
                ],
                key=lambda participant: (
                    0
                    if participant.get(
                        "alignment"
                    ) == "away"
                    else 1,
                    (
                        participant.get("order")
                        if participant.get(
                            "order"
                        ) is not None
                        else 99
                    ),
                ),
            )

            names = [
                str(participant["name"])
                for participant in ordered
            ]

            if len(names) >= 2:
                participants = names
                label = (
                    f"{names[0]} vs {names[1]}"
                )

            raw_start = market.get("startTime")

            if (
                isinstance(raw_start, str)
                and raw_start
            ):
                start_time = raw_start

            break

        team_markets = (
            self.team_markets_from_arrays(
                straight,
                markets,
                matchup_id,
                participants,
            )
        )

        parsed = urlparse(
            driver.current_url
        )

        return {
            "matchup_id": matchup_id_int,
            "source_url": driver.current_url,
            "path": parsed.path,
            "league": "NFL",
            "start_time": start_time,
            "label": label,
            "participants": participants,
            "props": props,
            "team_markets": team_markets,
        }

    def scrape_sequential(
        self,
        urls: list[str],
    ) -> list[dict[str, Any]]:
        driver = self.build_driver(
            discovery=False
        )

        games: list[dict[str, Any]] = []

        try:
            for index, url in enumerate(
                urls,
                start=1,
            ):
                print(
                    f"  [nfl {index}/{len(urls)}] "
                    f"{url}"
                )

                try:
                    games.append(
                        self.scrape_matchup(
                            driver,
                            url,
                        )
                    )
                except Exception as exc:
                    matchup_id, slug, _ = (
                        matchup_url_parts(url)
                    )

                    games.append(
                        {
                            "matchup_id": (
                                int(matchup_id)
                                if matchup_id
                                else None
                            ),
                            "source_url": url,
                            "slug": slug,
                            "error": str(exc),
                            "props": [],
                            "team_markets": {},
                            "league": "NFL",
                        }
                    )
        finally:
            driver.quit()

        return games

    def scrape_parallel(
        self,
        urls: list[str],
    ) -> list[dict[str, Any]]:
        worker_count = self.effective_workers(
            len(urls)
        )

        self.last_effective_parallel = (
            worker_count
        )

        batches: list[
            list[tuple[int, str]]
        ] = [
            []
            for _ in range(worker_count)
        ]

        for index, url in enumerate(urls):
            batches[
                index % worker_count
            ].append((index, url))

        merged: list[
            dict[str, Any] | None
        ] = [None] * len(urls)

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as pool:
            futures = {
                pool.submit(
                    worker_scrape_batch,
                    worker,
                    batches[worker],
                ): worker
                for worker in range(
                    worker_count
                )
                if batches[worker]
            }

            for future in as_completed(futures):
                worker = futures[future]

                try:
                    for index, game in (
                        future.result()
                    ):
                        merged[index] = game

                except Exception as exc:
                    for index, url in (
                        batches[worker]
                    ):
                        merged[index] = {
                            "matchup_id": None,
                            "source_url": url,
                            "error": (
                                f"worker "
                                f"{worker + 1}: {exc}"
                            ),
                            "props": [],
                            "team_markets": {},
                            "league": "NFL",
                        }

        return [
            game
            for game in merged
            if game is not None
        ]

    def write_snapshots(
        self,
        games: list[dict[str, Any]],
    ) -> tuple[str, str]:
        base = {
            "fetched_at": dt.datetime.now(
                _OUTPUT_TZ
            ).isoformat(timespec="seconds"),
            "source": "pinnacle_selenium",
            "sport": "football",
            "league": "nfl",
            "list_page": self.matchups_url,
            "arcadia_league_id": (
                NFL_ARCADIA_ID
            ),
            "parallel_workers_configured": (
                self.parallel_workers
            ),
            "parallel_workers_effective": (
                self.last_effective_parallel
            ),
            "games_per_worker_target": (
                self.games_per_worker
            ),
            "arcadia_timeout_s": (
                self.arcadia_timeout
            ),
            "arcadia_poll_s": (
                self.arcadia_poll
            ),
        }

        props = props_payload(
            base,
            games,
        )

        teams = team_payload(
            base,
            games,
        )

        props_path = self.output_path
        team_path = team_output_path(
            props_path
        )

        os.makedirs(
            os.path.dirname(
                os.path.abspath(props_path)
            ),
            exist_ok=True,
        )

        with open(
            props_path,
            "w",
            encoding="utf-8",
        ) as output:
            json.dump(
                props,
                output,
                indent=2,
                ensure_ascii=False,
            )

        with open(
            team_path,
            "w",
            encoding="utf-8",
        ) as output:
            json.dump(
                teams,
                output,
                indent=2,
                ensure_ascii=False,
            )

        return props_path, team_path

    def load_supabase(
        self,
        games: list[dict[str, Any]],
        *,
        props_path: str,
        team_path: str,
    ) -> bool:
        if _env_enabled(
            "PINNACLE_SKIP_DB"
        ):
            logger.info(
                "Skipping Supabase because "
                "PINNACLE_SKIP_DB is set"
            )
            return True

        try:
            from src.odds.load_snapshots import (
                load_pinnacle_props_snapshot,
                load_pinnacle_team_snapshot,
            )

            scraped_at = dt.datetime.now(
                dt.timezone.utc
            )

            props_count = (
                load_pinnacle_props_snapshot(
                    games,
                    league="nfl",
                    scraped_at=scraped_at,
                )
            )

            team_count = (
                load_pinnacle_team_snapshot(
                    games,
                    league="nfl",
                    scraped_at=scraped_at,
                )
            )

            logger.info(
                "Supabase NFL Pinnacle upserted "
                "props=%s team=%s "
                "props_path=%s team_path=%s",
                props_count,
                team_count,
                props_path,
                team_path,
            )

            return True

        except Exception as exc:
            logger.warning(
                "Supabase NFL Pinnacle load "
                "failed (JSON kept): %s",
                exc,
            )

            return False

    def run(
        self,
    ) -> tuple[dict[str, Any], bool]:
        print(
            "[nfl] Output: "
            f"{self.output_path} | "
            f"Arcadia league ID: "
            f"{NFL_ARCADIA_ID}"
        )

        discovery_driver = (
            self.build_driver(
                discovery=True
            )
        )

        try:
            urls = self.discover_game_urls(
                discovery_driver
            )
        finally:
            discovery_driver.quit()

        if not urls:
            print(
                "[nfl] No NFL game URLs found. "
                "Try PINNACLE_CHROME_VISIBLE=1 "
                "or verify "
                "PINNACLE_NFL_ARCADIA_ID."
            )

            games: list[
                dict[str, Any]
            ] = []

        elif self.parallel_workers <= 1:
            games = self.scrape_sequential(
                urls
            )
        else:
            games = self.scrape_parallel(
                urls
            )

        props_path, team_path = (
            self.write_snapshots(games)
        )

        db_ok = self.load_supabase(
            games,
            props_path=props_path,
            team_path=team_path,
        )

        prop_count = sum(
            len(game.get("props") or [])
            for game in games
        )

        print(
            f"✓ [nfl] Saved {len(games)} "
            f"games and {prop_count} props "
            f"→ {props_path} + {team_path}"
        )

        payload = props_payload(
            {
                "source": (
                    "pinnacle_selenium"
                ),
                "sport": "football",
                "league": "nfl",
            },
            games,
        )

        return payload, db_ok

def run_all() -> tuple[
    dict[str, dict[str, Any]],
    bool,
]:
    configured = os.environ.get(
        "PINNACLE_LEAGUES",
        "nfl",
    ).strip().lower()

    if configured != "nfl":
        raise ValueError(
            "PINNACLE_LEAGUES must be "
            "'nfl' for this scraper"
        )

    print(
        "=== Starting Pinnacle NFL "
        "scraper (Selenium) ==="
    )

    try:
        payload, db_ok = (
            PinnacleScraper().run()
        )

        return {"nfl": payload}, db_ok

    except Exception as exc:
        print(f"✗ [nfl] Error: {exc}")

        import traceback

        traceback.print_exc()

        return {}, False

if __name__ == "__main__":
    _, database_ok = run_all()

    if not database_ok:
        sys.exit(1)