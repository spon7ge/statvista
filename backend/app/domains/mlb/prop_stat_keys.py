"""Canonical stat-key mapping for MLB prop picks across DFS and sharp books.

MLB has its own stat vocabulary (total bases, strikeouts split by batter vs.
pitcher, etc.), so this mirrors ``app.domains.betting.prop_stat_keys`` for the
WNBA/basketball domain rather than extending it directly — domains must not
import each other (see ``test_domain_cross_import_boundary.py``).
"""

from __future__ import annotations

# PrizePicks ``stat_type`` values (Title Case, sometimes with ``+``) normalized
# to snake_case via ``_norm`` below.
_PP_ALIASES: dict[str, str] = {
    "hits": "hits",
    "hits_allowed": "hits_allowed",
    "hits_runs_rbis": "hits_runs_rbis",
    "home_runs": "home_runs",
    "rbis": "rbis",
    "runs": "runs",
    "singles": "singles",
    "doubles": "doubles",
    "triples": "triples",
    "stolen_bases": "stolen_bases",
    "total_bases": "total_bases",
    "walks": "walks",
    "walks_allowed": "walks_allowed",
    "earned_runs_allowed": "earned_runs_allowed",
    "hitter_strikeouts": "batter_strikeouts",
    "pitcher_strikeouts": "pitcher_strikeouts",
    "pitching_outs": "pitching_outs",
    "pitches_thrown": "pitches_thrown",
    "plate_appearances": "plate_appearances",
}

# Underdog ``stat_name`` values (already snake_case).
_UD_ALIASES: dict[str, str] = {
    "strikeouts": "pitcher_strikeouts",
    "batter_strikeouts": "batter_strikeouts",
    "doubles": "doubles",
    "hits": "hits",
    "hits_allowed": "hits_allowed",
    "hits_runs_rbis": "hits_runs_rbis",
    "home_runs": "home_runs",
    "pitch_outs": "pitching_outs",
    "rbis": "rbis",
    "runs": "runs",
    "runs_allowed": "runs_allowed",
    "singles": "singles",
    "stolen_bases": "stolen_bases",
    "total_bases": "total_bases",
    "walks": "walks",
    "walks_allowed": "walks_allowed",
}

# ProphetX ``stat_name`` already emits bare canonical names (see
# ``src/scrapers/mlb_prophetx.py::PROP_SUBTYPE_TO_STAT``). Pinnacle
# ``market_type`` and ParlayAPI ``market_key`` prefix the same bare names with
# ``player_``/``batter_``/``pitcher_`` (mirrors the WNBA convention, e.g.
# ``player_points``).
_SHARP_ALIASES: dict[str, str] = {
    "hits": "hits",
    "hits_allowed": "hits_allowed",
    "home_runs": "home_runs",
    "rbis": "rbis",
    "runs": "runs",
    "runs_scored": "runs",
    "runs_allowed": "runs_allowed",
    "singles": "singles",
    "doubles": "doubles",
    "triples": "triples",
    "stolen_bases": "stolen_bases",
    "total_bases": "total_bases",
    "walks": "walks",
    "walks_allowed": "walks_allowed",
    "earned_runs": "earned_runs_allowed",
    "earned_runs_allowed": "earned_runs_allowed",
    "outs": "pitching_outs",
    "pitching_outs": "pitching_outs",
    "pitches_thrown": "pitches_thrown",
    "plate_appearances": "plate_appearances",
    # Bare "strikeouts" without a batter_/pitcher_ prefix defaults to the
    # far more common pitcher-strikeouts market.
    "strikeouts": "pitcher_strikeouts",
}

# The Odds API ``market`` keys (snake_case, v1 allowlist).
_ODDS_API_ALIASES: dict[str, str] = {
    "batter_hits": "hits",
    "batter_home_runs": "home_runs",
    "batter_total_bases": "total_bases",
    "batter_rbis": "rbis",
    "batter_runs_scored": "runs",
    "batter_singles": "singles",
    "batter_doubles": "doubles",
    "batter_triples": "triples",
    "batter_walks": "walks",
    "batter_strikeouts": "batter_strikeouts",
    "batter_stolen_bases": "stolen_bases",
    "batter_hits_runs_rbis": "hits_runs_rbis",
    "pitcher_strikeouts": "pitcher_strikeouts",
    "pitcher_hits_allowed": "hits_allowed",
    "pitcher_walks": "walks_allowed",
    "pitcher_earned_runs": "earned_runs_allowed",
    "pitcher_outs": "pitching_outs",
}

_SHARP_PREFIXES: tuple[str, ...] = ("player_", "batter_", "pitcher_")

_LABELS: dict[str, str] = {
    "hits": "Hits",
    "hits_allowed": "Hits Allowed",
    "hits_runs_rbis": "Hits+Runs+RBIs",
    "home_runs": "Home Runs",
    "rbis": "RBIs",
    "runs": "Runs",
    "runs_allowed": "Runs Allowed",
    "singles": "Singles",
    "doubles": "Doubles",
    "triples": "Triples",
    "stolen_bases": "Stolen Bases",
    "total_bases": "Total Bases",
    "walks": "Walks",
    "walks_allowed": "Walks Allowed",
    "earned_runs_allowed": "Earned Runs Allowed",
    "batter_strikeouts": "Hitter Strikeouts",
    "pitcher_strikeouts": "Pitcher Strikeouts",
    "pitching_outs": "Pitching Outs",
    "pitches_thrown": "Pitches Thrown",
    "plate_appearances": "Plate Appearances",
}

# Display order for game Preview / DFS category cards.
GAME_PROP_CATEGORY_ORDER: tuple[str, ...] = (
    "home_runs",
    "hits",
    "hits_runs_rbis",
    "total_bases",
    "rbis",
    "runs",
    "singles",
    "doubles",
    "triples",
    "stolen_bases",
    "walks",
    "batter_strikeouts",
    "pitcher_strikeouts",
    "hits_allowed",
    "walks_allowed",
    "earned_runs_allowed",
    "runs_allowed",
    "pitching_outs",
    "pitches_thrown",
    "plate_appearances",
)


def _norm(raw: str) -> str:
    return raw.strip().lower().replace(" ", "_").replace("+", "_")


def canonical_stat_key_from_pp_mlb(stat_type: str) -> str | None:
    return _PP_ALIASES.get(_norm(stat_type))


def canonical_stat_key_from_ud_mlb(stat_name: str) -> str | None:
    return _UD_ALIASES.get(_norm(stat_name))


def canonical_stat_key_from_odds_api_mlb(market_key: str) -> str | None:
    return _ODDS_API_ALIASES.get(_norm(market_key))


def canonical_stat_key_from_sharp_mlb(market_key: str) -> str | None:
    """Map a ProphetX ``stat_name``, Pinnacle ``market_type``, or Parlay
    ``market_key`` to a canonical MLB stat key.

    Tries the prefixed form first (so ``batter_strikeouts`` and
    ``pitcher_strikeouts`` resolve to distinct keys) before falling back to
    the bare form (ProphetX already emits bare names).

    Parlay alt props use the same base key with a trailing ``_alternate``
    suffix (e.g. ``player_total_bases_alternate``); strip it once so alts
    share the main canonical key.
    """
    norm = _norm(market_key)
    if norm.endswith("_alternate"):
        norm = norm[: -len("_alternate")]
    for prefix in _SHARP_PREFIXES:
        if not norm.startswith(prefix):
            continue
        stripped = norm[len(prefix) :]
        if prefix == "batter_" and stripped == "strikeouts":
            return "batter_strikeouts"
        if prefix == "pitcher_" and stripped == "strikeouts":
            return "pitcher_strikeouts"
        mapped = _SHARP_ALIASES.get(stripped)
        if mapped:
            return mapped
        norm = stripped
        break
    return _SHARP_ALIASES.get(norm)


def display_stat_label(stat_key: str, fallback: str | None = None) -> str:
    return _LABELS.get(stat_key) or fallback or stat_key.replace("_", " ").title()
