"""Thin HTTP client for The Odds API (https://the-odds-api.com/)."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import THE_ODDS_API_KEY

ODDS_API_BASE_URL = "https://api.the-odds-api.com"
DEFAULT_TIMEOUT_SECONDS = 12.0


def require_odds_api_key() -> str:
    if not THE_ODDS_API_KEY:
        raise RuntimeError("THE_ODDS_API_KEY is not configured")
    return THE_ODDS_API_KEY


async def odds_api_get(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Any:
    """GET an Odds API path (e.g. ``/v4/sports/baseball_mlb/events``)."""
    api_key = require_odds_api_key()
    query = dict(params or {})
    query["apiKey"] = api_key
    headers = {"Accept": "application/json"}
    url = f"{ODDS_API_BASE_URL}{path}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.get(url, headers=headers, params=query)
        try:
            res.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = (exc.response.text or "")[:500]
            raise httpx.HTTPStatusError(
                f"{exc} body={body!r}",
                request=exc.request,
                response=exc.response,
            ) from None
        return res.json()
