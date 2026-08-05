"""Shared helpers for external HTTP providers."""

import httpx

DEFAULT_TIMEOUT_SECONDS = 8.0


def http_client(**kwargs) -> httpx.Client:
    """Return an HTTP client with the default timeout unless overridden."""
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT_SECONDS)
    return httpx.Client(timeout=timeout, **kwargs)
