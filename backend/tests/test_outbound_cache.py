from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

import app.core.outbound_cache as oc


@pytest.fixture
def cache_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(oc, "DEFAULT_CACHE_DIR", tmp_path)
    oc.clear_outbound_cache(wipe_disk=True)
    yield tmp_path
    oc.clear_outbound_cache(wipe_disk=True)


def _mock_response(payload: dict, status: int = 200) -> MagicMock:
    res = MagicMock()
    res.status_code = status
    res.json.return_value = payload
    res.raise_for_status = MagicMock()
    if status >= 400:
        res.raise_for_status.side_effect = httpx.HTTPStatusError(
            "err", request=MagicMock(), response=res
        )
    return res


@pytest.mark.asyncio
async def test_fresh_memory_hit_skips_http(cache_dir: Path) -> None:
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"ok": 1}))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        first = await oc.get_json("k1", "https://example.com/a", ttl_seconds=600)
        second = await oc.get_json("k1", "https://example.com/a", ttl_seconds=600)

    assert first == {"ok": 1}
    assert second == {"ok": 1}
    assert client.get.await_count == 1


@pytest.mark.asyncio
async def test_successful_fetch_writes_disk_envelope(cache_dir: Path) -> None:
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"n": 2}))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        await oc.get_json(
            "espn:wnba:standings", "https://example.com/s", ttl_seconds=600
        )

    path = cache_dir / f"{oc.safe_key('espn:wnba:standings')}.json"
    assert path.is_file()
    envelope = json.loads(path.read_text(encoding="utf-8"))
    assert envelope["body"] == {"n": 2}
    assert envelope["ttl_seconds"] == 600
    assert envelope["key"] == "espn:wnba:standings"


@pytest.mark.asyncio
async def test_disk_hit_after_memory_clear(cache_dir: Path) -> None:
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"from": "net"}))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        await oc.get_json("k2", "https://example.com/b", ttl_seconds=600)

    oc.clear_outbound_cache(wipe_disk=False)
    client.get.reset_mock()

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        body = await oc.get_json("k2", "https://example.com/b", ttl_seconds=600)

    assert body == {"from": "net"}
    assert client.get.await_count == 0


@pytest.mark.asyncio
async def test_concurrent_cold_misses_single_upstream(cache_dir: Path) -> None:
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow_get(*_a, **_k):
        started.set()
        await release.wait()
        return _mock_response({"once": True})

    client = AsyncMock()
    client.get = AsyncMock(side_effect=slow_get)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        t1 = asyncio.create_task(
            oc.get_json("ck", "https://example.com/c", ttl_seconds=60)
        )
        await started.wait()
        t2 = asyncio.create_task(
            oc.get_json("ck", "https://example.com/c", ttl_seconds=60)
        )
        release.set()
        a, b = await asyncio.gather(t1, t2)

    assert a == b == {"once": True}
    assert client.get.await_count == 1


@pytest.mark.asyncio
async def test_expired_returns_stale_and_revalidates(
    cache_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(oc, "MIN_INTERVAL_SECONDS", 0)
    client = AsyncMock()
    client.get = AsyncMock(
        side_effect=[
            _mock_response({"v": 1}),
            _mock_response({"v": 2}),
        ]
    )
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        first = await oc.get_json("swr", "https://example.com/s", ttl_seconds=60)
        assert first == {"v": 1}
        oc._memory["swr"]["fetched_at"] = time.time() - 120
        second = await oc.get_json("swr", "https://example.com/s", ttl_seconds=60)
        assert second == {"v": 1}
        for _ in range(50):
            if client.get.await_count >= 2:
                break
            await asyncio.sleep(0.01)
        assert client.get.await_count == 2
        third = await oc.get_json("swr", "https://example.com/s", ttl_seconds=60)
        assert third == {"v": 2}


@pytest.mark.asyncio
async def test_403_without_stale_raises(cache_dir: Path) -> None:
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"err": 1}, status=403))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        with pytest.raises(httpx.HTTPStatusError):
            await oc.get_json("miss", "https://site.api.espn.com/x", ttl_seconds=60)


@pytest.mark.asyncio
async def test_timeout_does_not_trigger_host_backoff(cache_dir: Path) -> None:
    url = "https://site.api.espn.com/timeout"
    host = oc._host_for(url)
    client = AsyncMock()
    client.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        with pytest.raises(httpx.TimeoutException):
            await oc.get_json("to", url, ttl_seconds=60)

    assert host not in oc._host_backoff_until
    assert host not in oc._host_backoff_seconds


@pytest.mark.asyncio
async def test_404_does_not_trigger_host_backoff(cache_dir: Path) -> None:
    url = "https://site.api.espn.com/missing"
    host = oc._host_for(url)
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"err": 1}, status=404))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        with pytest.raises(httpx.HTTPStatusError):
            await oc.get_json("nf", url, ttl_seconds=60)

    assert host not in oc._host_backoff_until
    assert host not in oc._host_backoff_seconds


@pytest.mark.asyncio
async def test_403_with_stale_returns_stale_and_skips_during_backoff(
    cache_dir: Path,
) -> None:
    url = "https://site.api.espn.com/y"
    oc._memory["bk"] = {
        "key": "bk",
        "url": url,
        "fetched_at": time.time() - 999,
        "ttl_seconds": 60,
        "body": {"ok": True},
    }
    path = cache_dir / f"{oc.safe_key('bk')}.json"
    path.write_text(json.dumps(oc._memory["bk"]), encoding="utf-8")

    failing = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "403",
            request=MagicMock(),
            response=_mock_response({}, status=403),
        )
    )
    with patch.object(oc, "_fetch_upstream", failing):
        body = await oc.get_json("bk", url, ttl_seconds=60)
    assert body == {"ok": True}

    host = oc._host_for(url)
    oc._host_backoff_until[host] = time.time() + 300
    oc._memory["bk"]["fetched_at"] = time.time() - 999
    client = AsyncMock()
    client.get = AsyncMock(return_value=_mock_response({"nope": 1}))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    with patch.object(oc.httpx, "AsyncClient", return_value=client):
        body2 = await oc.get_json("bk", url, ttl_seconds=60)
    assert body2 == {"ok": True}
    assert client.get.await_count == 0
