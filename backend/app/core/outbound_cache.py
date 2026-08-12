from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path("data/cache/outbound")
DEFAULT_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}
MIN_INTERVAL_SECONDS = 1.0
BACKOFF_INITIAL_SECONDS = 30.0
BACKOFF_CAP_SECONDS = 600.0

_memory: dict[str, dict[str, Any]] = {}
_inflight: dict[str, asyncio.Task[Any]] = {}
_host_backoff_until: dict[str, float] = {}
_host_backoff_seconds: dict[str, float] = {}
_host_last_request: dict[str, float] = {}
_host_locks: dict[str, asyncio.Lock] = {}


def safe_key(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", key)


def clear_outbound_cache(*, wipe_disk: bool = False) -> None:
    _memory.clear()
    _inflight.clear()
    _host_backoff_until.clear()
    _host_backoff_seconds.clear()
    _host_last_request.clear()
    _host_locks.clear()
    if wipe_disk and DEFAULT_CACHE_DIR.is_dir():
        for path in DEFAULT_CACHE_DIR.glob("*.json"):
            try:
                path.unlink()
            except OSError as exc:
                logger.warning("outbound cache unlink failed %s: %s", path, exc)


def _cache_path(key: str) -> Path:
    return DEFAULT_CACHE_DIR / f"{safe_key(key)}.json"


def _read_disk(key: str) -> dict[str, Any] | None:
    path = _cache_path(key)
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("outbound cache read failed %s: %s", key, exc)
        return None
    if not isinstance(raw, dict) or "body" not in raw:
        return None
    return raw


def _write_disk(envelope: dict[str, Any]) -> None:
    path = _cache_path(str(envelope["key"]))
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(envelope), encoding="utf-8")
    except Exception as exc:
        logger.warning(
            "outbound cache write failed %s: %s", envelope.get("key"), exc
        )


def _fresh(entry: dict[str, Any], now: float) -> bool:
    fetched_at = float(entry.get("fetched_at") or 0)
    ttl = float(entry.get("ttl_seconds") or 0)
    return fetched_at + ttl > now


def _host_for(url: str) -> str:
    return urlparse(url).netloc.lower() or "unknown"


def _get_host_lock(host: str) -> asyncio.Lock:
    lock = _host_locks.get(host)
    if lock is None:
        lock = asyncio.Lock()
        _host_locks[host] = lock
    return lock


async def _wait_for_host(host: str) -> None:
    while True:
        now = time.time()
        backoff_until = float(_host_backoff_until.get(host) or 0)
        if backoff_until > now:
            await asyncio.sleep(min(backoff_until - now, 1.0))
            continue
        last = float(_host_last_request.get(host) or 0)
        wait = MIN_INTERVAL_SECONDS - (now - last)
        if wait > 0:
            await asyncio.sleep(wait)
            continue
        return


def _note_success(host: str) -> None:
    _host_last_request[host] = time.time()
    _host_backoff_until.pop(host, None)
    _host_backoff_seconds.pop(host, None)


def _note_failure(host: str) -> None:
    now = time.time()
    _host_last_request[host] = now
    prev = float(_host_backoff_seconds.get(host) or (BACKOFF_INITIAL_SECONDS / 2))
    nxt = min(max(prev * 2, BACKOFF_INITIAL_SECONDS), BACKOFF_CAP_SECONDS)
    _host_backoff_seconds[host] = nxt
    _host_backoff_until[host] = now + nxt


def _is_backoff_status(status_code: int) -> bool:
    return status_code in (403, 429) or status_code >= 500


async def _fetch_upstream(
    url: str,
    *,
    headers: dict[str, str],
    timeout_seconds: float,
) -> Any:
    host = _host_for(url)
    async with _get_host_lock(host):
        await _wait_for_host(host)
        try:
            async with httpx.AsyncClient(
                timeout=timeout_seconds, headers=headers
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            if _is_backoff_status(exc.response.status_code):
                _note_failure(host)
            else:
                _host_last_request[host] = time.time()
            raise
        except (httpx.TimeoutException, httpx.ConnectError):
            raise
        except Exception:
            _host_last_request[host] = time.time()
            raise
        _note_success(host)
        return data


async def _refresh(
    key: str,
    url: str,
    *,
    ttl_seconds: float,
    headers: dict[str, str],
    timeout_seconds: float,
) -> Any:
    body = await _fetch_upstream(
        url,
        headers=headers,
        timeout_seconds=timeout_seconds,
    )
    envelope = {
        "key": key,
        "url": url,
        "fetched_at": time.time(),
        "ttl_seconds": ttl_seconds,
        "body": body,
    }
    _memory[key] = envelope
    _write_disk(envelope)
    return body


def _schedule_refresh(
    key: str,
    url: str,
    *,
    ttl_seconds: float,
    headers: dict[str, str],
    timeout_seconds: float,
) -> None:
    existing = _inflight.get(key)
    if existing is not None and not existing.done():
        return

    async def runner() -> Any:
        try:
            return await _refresh(
                key,
                url,
                ttl_seconds=ttl_seconds,
                headers=headers,
                timeout_seconds=timeout_seconds,
            )
        except Exception as exc:
            logger.warning("outbound SWR refresh failed %s: %s", key, exc)
            raise
        finally:
            current = _inflight.get(key)
            if current is asyncio.current_task():
                _inflight.pop(key, None)

    _inflight[key] = asyncio.create_task(runner())


async def get_json(
    key: str,
    url: str,
    *,
    ttl_seconds: float,
    headers: dict[str, str] | None = None,
    timeout_seconds: float = 10.0,
) -> Any:
    merged = dict(DEFAULT_HEADERS)
    if headers:
        merged.update(headers)
    now = time.time()

    mem = _memory.get(key)
    if mem is not None and _fresh(mem, now):
        return mem["body"]

    if mem is not None and not _fresh(mem, now):
        host = _host_for(url)
        in_backoff = float(_host_backoff_until.get(host) or 0) > now
        if in_backoff:
            logger.warning(
                "outbound serving stale during backoff key=%s host=%s",
                key,
                host,
            )
            return mem["body"]
        _schedule_refresh(
            key,
            url,
            ttl_seconds=ttl_seconds,
            headers=merged,
            timeout_seconds=timeout_seconds,
        )
        return mem["body"]

    disk = _read_disk(key)
    if disk is not None:
        _memory[key] = disk
        if _fresh(disk, now):
            return disk["body"]

    stale = _memory.get(key) or disk
    host = _host_for(url)
    in_backoff = float(_host_backoff_until.get(host) or 0) > now

    if stale is not None:
        if in_backoff:
            logger.warning(
                "outbound serving stale during backoff key=%s host=%s",
                key,
                host,
            )
            return stale["body"]
        if not _fresh(stale, now):
            _schedule_refresh(
                key,
                url,
                ttl_seconds=ttl_seconds,
                headers=merged,
                timeout_seconds=timeout_seconds,
            )
            return stale["body"]

    existing = _inflight.get(key)
    if existing is not None and not existing.done():
        return await existing

    async def runner() -> Any:
        try:
            return await _refresh(
                key,
                url,
                ttl_seconds=ttl_seconds,
                headers=merged,
                timeout_seconds=timeout_seconds,
            )
        finally:
            current = _inflight.get(key)
            if current is asyncio.current_task():
                _inflight.pop(key, None)

    task = asyncio.create_task(runner())
    _inflight[key] = task
    try:
        return await task
    except Exception:
        stale_after = _memory.get(key) or _read_disk(key)
        if stale_after is not None:
            logger.warning("outbound fetch failed; serving stale key=%s", key)
            return stale_after["body"]
        raise
