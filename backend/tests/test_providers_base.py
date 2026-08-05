import httpx


def test_http_client_uses_default_timeout():
    from app.providers.base import DEFAULT_TIMEOUT_SECONDS, http_client

    with http_client() as client:
        assert isinstance(client, httpx.Client)
        assert client.timeout.connect == DEFAULT_TIMEOUT_SECONDS
