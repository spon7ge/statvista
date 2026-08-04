"""RotoWire MLB daily projected lineups scraper.

Fetches and parses the RotoWire MLB daily lineups page into a list of
per-game dicts containing each side's starting pitcher and 1-9 batting
order. Used to back the `/api/mlb/lineups` route (see
`docs/superpowers/specs/2026-08-04-mlb-rotowire-projected-lineups-design.md`).

Usage:
    from src.scrapers.mlb_rotowire_lineups import scrape_mlb_lineups
    games = scrape_mlb_lineups()              # today's slate
    games = scrape_mlb_lineups(date_token="tomorrow")
"""

from __future__ import annotations

import re
from typing import Any

import requests
from bs4 import BeautifulSoup
from bs4.element import Tag

MLB_LINEUPS_URL = "https://www.rotowire.com/baseball/daily-lineups.php"

_REQUEST_TIMEOUT_SECONDS = 30
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_PITCHER_STATS_RE = re.compile(r"(\d+-\d+)\s+([\d.]+)\s*ERA")


def fetch_mlb_lineups_html(*, date_token: str | None = None) -> str:
    """Fetch the raw RotoWire MLB daily lineups HTML.

    `date_token=None` (or empty) fetches today's slate. `date_token="tomorrow"`
    passes RotoWire's `date=tomorrow` query param, the only other slate the
    page publishes.
    """
    params: dict[str, str] = {}
    if date_token == "tomorrow":
        params["date"] = "tomorrow"

    response = requests.get(
        MLB_LINEUPS_URL,
        params=params or None,
        timeout=_REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": _USER_AGENT},
    )
    response.raise_for_status()
    return response.text


def parse_mlb_lineups_html(html: str) -> list[dict[str, Any]]:
    """Parse RotoWire MLB daily lineups HTML into a list of game dicts.

    Each game dict has the shape:
        {
            "away_abbrev": str, "home_abbrev": str, "status": str | None,
            "away": {"pitcher": {...}, "batters": [...]},
            "home": {"pitcher": {...}, "batters": [...]},
        }
    """
    soup = BeautifulSoup(html, "html.parser")
    cards = _select_lineup_cards(soup)

    games: list[dict[str, Any]] = []
    for card in cards:
        away_abbrev = _extract_team_abbrev(card, "is-visit")
        home_abbrev = _extract_team_abbrev(card, "is-home")
        if not away_abbrev or not home_abbrev:
            continue

        away_list = _find_side_list(card, "is-visit")
        home_list = _find_side_list(card, "is-home")

        games.append(
            {
                "away_abbrev": away_abbrev,
                "home_abbrev": home_abbrev,
                "status": _extract_status(card),
                "away": {
                    "pitcher": _extract_pitcher(away_list),
                    "batters": _extract_batters(away_list),
                },
                "home": {
                    "pitcher": _extract_pitcher(home_list),
                    "batters": _extract_batters(home_list),
                },
            }
        )

    return games


def scrape_mlb_lineups(*, date_token: str | None = None) -> list[dict[str, Any]]:
    """Fetch + parse RotoWire's MLB daily lineups for the given slate."""
    html = fetch_mlb_lineups_html(date_token=date_token)
    return parse_mlb_lineups_html(html)


def _select_lineup_cards(soup: BeautifulSoup) -> list[Tag]:
    """Return top-level `div.lineup` game cards, preferring `is-mlb` ones.

    `class_="lineup"` matches the exact `lineup` class token, so RotoWire's
    `lineup__*` sub-elements (e.g. `lineup__list`, `lineup__player`) are not
    picked up here.
    """
    all_cards = soup.find_all("div", class_="lineup")
    mlb_cards = [tag for tag in all_cards if "is-mlb" in tag.get("class", [])]
    return mlb_cards or all_cards


def _find_side_list(card: Tag, side_class: str) -> Tag | None:
    for ul in card.find_all("ul", class_="lineup__list"):
        if side_class in ul.get("class", []):
            return ul
    return None


def _extract_team_abbrev(card: Tag, side_class: str) -> str | None:
    for team_div in card.find_all("div", class_="lineup__team"):
        if side_class in team_div.get("class", []):
            abbr_div = team_div.find("div", class_="lineup__abbr")
            if abbr_div:
                return abbr_div.get_text(strip=True)
    return None


def _extract_status(card: Tag) -> str | None:
    status_li = card.find("li", class_="lineup__status")
    if not status_li:
        return None
    text = status_li.get_text(strip=True).lower()
    if "confirmed" in text:
        return "confirmed"
    if "expected" in text:
        return "expected"
    return text or None


def _extract_pitcher(side_list: Tag | None) -> dict[str, Any]:
    """Extract SP name/hand/record/era from the highlight `li` in `side_list`."""
    empty = {"name": None, "hand": None, "record": None, "era": None}
    if side_list is None:
        return empty

    highlight = side_list.find("li", class_="lineup__player-highlight")
    if highlight is None:
        return empty

    name_el = highlight.find("a")
    name = name_el.get_text(strip=True) if name_el else None

    throws_el = highlight.find("span", class_="lineup__throws")
    hand = throws_el.get_text(strip=True) or None if throws_el else None

    record: str | None = None
    era: str | None = None
    stats_el = highlight.find("div", class_="lineup__player-highlight-stats")
    if stats_el:
        match = _PITCHER_STATS_RE.search(stats_el.get_text(" ", strip=True))
        if match:
            record, era = match.group(1), match.group(2)

    return {"name": name, "hand": hand, "record": record, "era": era}


def _extract_batters(side_list: Tag | None) -> list[dict[str, Any]]:
    if side_list is None:
        return []

    batters: list[dict[str, Any]] = []
    for order, player_li in enumerate(
        side_list.find_all("li", class_="lineup__player"), start=1
    ):
        pos_el = player_li.find("div", class_="lineup__pos")
        name_el = player_li.find("a")
        bats_el = player_li.find("span", class_="lineup__bats")

        batters.append(
            {
                "order": order,
                "position": pos_el.get_text(strip=True) if pos_el else None,
                "name": name_el.get_text(strip=True) if name_el else None,
                "hand": bats_el.get_text(strip=True) if bats_el else None,
            }
        )

    return batters
