import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (two levels above backend/)
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env")

REPO_ROOT = _REPO_ROOT
DATA_DIR = REPO_ROOT / "data" / "props"

# Supabase / PostgreSQL — used by app/core/db.py
SUPABASE_DB_URL: str | None = os.environ.get("SUPABASE_DB_URL")

BOOK_FILE_BASE: dict[str, str] = {
    "prizepicks": "prizepicks",
    "underdog": "underdog",
    "draftkings": "draftKings",
    "betr": "betr",
}

VALID_LEG_COUNTS = {2, 3, 5, 6}

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]


def parse_cors_origins(raw: str | None) -> list[str]:
    """Parse a comma-separated CORS origin list; empty/missing uses defaults."""
    if raw is None:
        return list(DEFAULT_CORS_ORIGINS)
    origins = [part.strip() for part in raw.split(",") if part.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


CORS_ORIGINS = parse_cors_origins(os.environ.get("CORS_ORIGINS"))

# SharpAPI — legacy; WNBA odds/props now use ParlayAPI
SHARP_API_KEY: str | None = os.environ.get("SHARP_API_KEY") or None
# Strip accidental quotes from .env values like SHARP_API_KEY='sk_...'
if SHARP_API_KEY:
    SHARP_API_KEY = SHARP_API_KEY.strip().strip("'").strip('"') or None

# ParlayAPI — WNBA props + matchup odds (optional; empty → empty response)
PARLAY_API_KEY: str | None = os.environ.get("PARLAY_API_KEY") or None
if PARLAY_API_KEY:
    PARLAY_API_KEY = PARLAY_API_KEY.strip().strip("'").strip('"') or None

# The Odds API — MLB prop picks board + books (optional; empty → soft-fail)
THE_ODDS_API_KEY: str | None = os.environ.get("THE_ODDS_API_KEY") or None
if THE_ODDS_API_KEY:
    THE_ODDS_API_KEY = THE_ODDS_API_KEY.strip().strip("'").strip('"') or None
