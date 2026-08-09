import pytest
from unittest.mock import AsyncMock, patch

from app.providers.odds_api.client import odds_api_get


@pytest.mark.asyncio
async def test_odds_api_get_requires_key(monkeypatch):
    monkeypatch.setattr("app.providers.odds_api.client.THE_ODDS_API_KEY", None)
    with pytest.raises(RuntimeError, match="THE_ODDS_API_KEY"):
        await odds_api_get("/v4/sports/baseball_mlb/odds")


@pytest.mark.asyncio
async def test_odds_api_get_passes_api_key_query(monkeypatch):
    monkeypatch.setattr("app.providers.odds_api.client.THE_ODDS_API_KEY", "test-key")
    mock_res = AsyncMock()
    mock_res.raise_for_status = lambda: None
    mock_res.json = lambda: [{"id": "evt1"}]
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.get = AsyncMock(return_value=mock_res)
    with patch("app.providers.odds_api.client.httpx.AsyncClient", return_value=mock_client):
        data = await odds_api_get(
            "/v4/sports/baseball_mlb/events/evt1/odds",
            params={"regions": "us", "markets": "batter_hits"},
        )
    assert data == [{"id": "evt1"}]
    args, kwargs = mock_client.get.call_args
    assert kwargs["params"]["apiKey"] == "test-key"
    assert "regions" in kwargs["params"]
