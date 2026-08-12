# Outbound Cache (ESPN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared memory+disk outbound JSON cache with TTL, coalescing, host rate-limit/backoff, and stale-while-revalidate; wire WNBA standings and ESPN roster through it so 403s can serve last-good snapshots across restarts.

**Architecture:** New `app.core.outbound_cache.get_json` owns L1 memory, L2 disk envelopes under `data/cache/outbound/`, inflight Futures, per-host min-interval + exponential backoff. Standings and roster replace raw `httpx` GETs with keyed `get_json` calls; existing domain response caches stay.

**Tech Stack:** Python 3, httpx, asyncio, pytest, pathlib JSON envelopes

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-outbound-cache-espn-design.md`
- Product name **statvista** in any new user-facing copy
- No route / OpenAPI / frontend changes
- No ETag / Supabase / migrating non-v1 callers
- Do not commit unless the user explicitly asks
- Follow `md/claude.md` (small focused changes, tests with code, strong typing)
- Working directory for pytest: `backend/` with `PYTHONPATH` as existing tests use

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/core/outbound_cache.py` | Shared `get_json`, disk I/O, coalesce, rate limit, backoff, SWR |
| `backend/tests/test_outbound_cache.py` | Unit tests with mocked HTTP + tmp cache dir |
| `backend/app/domains/wnba/standings.py` | `fetch_espn_standings` → `get_json` |
| `backend/app/providers/espn/wnba_roster.py` | Roster + teams list → `get_json` |
| `md/system-design.md` | One-line note that standings/roster JSON use outbound cache |

---

### Task 1: Outbound cache core — TTL memory + disk

**Files:**
- Create: `backend/app/core/outbound_cache.py`
- Create: `backend/tests/test_outbound_cache.py`

**Interfaces:**
- Produces:
  - `DEFAULT_CACHE_DIR: Path` → `Path("data/cache/outbound")`
  - `DEFAULT_HEADERS: dict[str, str]` → `User-Agent` + `Accept: application/json`
  - `safe_key(key: str) -> str`
  - `clear_outbound_cache(*, wipe_disk: bool = False) -> None`
  - `async def get_json(key: str, url: str, *, ttl_seconds: float, headers: dict[str, str] | None = None, timeout_seconds: float = 10.0) -> Any`
  - Internal envelope fields: `key`, `url`, `fetched_at`, `ttl_seconds`, `body`

- [ ] **Step 1: Write failing tests for fresh hit + disk persist**

Create `backend/tests/test_outbound_cache.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
python -m pytest tests/test_outbound_cache.py -v
```

Expected: FAIL (module / `get_json` missing)

- [ ] **Step 3: Implement minimal core**

Create `backend/app/core/outbound_cache.py` with:

- `safe_key`, `clear_outbound_cache`, disk read/write envelopes
- `get_json` with memory → disk → SWR schedule → coalesced cold fetch
- Per-host `MIN_INTERVAL_SECONDS = 1.0`, backoff `30` → double → cap `600`
- Default headers matching standings (`Mozilla/5.0`, `Accept: application/json`)
- On upstream failure: return stale body if any L1/L2 exists, else re-raise
- Never delete disk snapshots on failure

Reference implementation shape (implement fully; adjust only if tests require):

```python
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
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
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
        except Exception:
            _note_failure(host)
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
        url, headers=headers, timeout_seconds=timeout_seconds
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
```

- [ ] **Step 4: Run Task 1 tests**

```bash
cd backend
python -m pytest tests/test_outbound_cache.py::test_fresh_memory_hit_skips_http tests/test_outbound_cache.py::test_successful_fetch_writes_disk_envelope tests/test_outbound_cache.py::test_disk_hit_after_memory_clear -v
```

Expected: PASS

- [ ] **Step 5: Commit only if the user asks**

---

### Task 2: Coalescing + stale-while-revalidate tests

**Files:**
- Modify: `backend/tests/test_outbound_cache.py`
- Modify: `backend/app/core/outbound_cache.py` only if fixes needed

**Interfaces:**
- Consumes: `get_json`, `clear_outbound_cache`, `_memory` (tests may backdate `fetched_at`)

- [ ] **Step 1: Add coalesce + SWR tests**

Append to `backend/tests/test_outbound_cache.py`:

```python
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
async def test_expired_returns_stale_and_revalidates(cache_dir: Path) -> None:
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
```

- [ ] **Step 2: Run new tests**

```bash
cd backend
python -m pytest tests/test_outbound_cache.py::test_concurrent_cold_misses_single_upstream tests/test_outbound_cache.py::test_expired_returns_stale_and_revalidates -v
```

Expected: PASS

- [ ] **Step 3: Commit only if the user asks**

---

### Task 3: Hard fail + backoff soft fail

**Files:**
- Modify: `backend/tests/test_outbound_cache.py`
- Modify: `backend/app/core/outbound_cache.py` if needed

**Interfaces:**
- Consumes: `get_json`, `_host_for`, `_host_backoff_until`

- [ ] **Step 1: Add tests**

```python
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
async def test_403_with_stale_returns_stale_and_skips_during_backoff(
    cache_dir: Path,
) -> None:
    url = "https://site.api.espn.com/y"
    # Seed expired stale body
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
```

- [ ] **Step 2: Run full outbound suite**

```bash
cd backend
python -m pytest tests/test_outbound_cache.py -v
```

Expected: all PASS

- [ ] **Step 3: Commit only if the user asks**

---

### Task 4: Wire WNBA standings

**Files:**
- Modify: `backend/app/domains/wnba/standings.py`
- Possibly update mocks in `backend/tests/test_wnba_standings_route.py`

**Interfaces:**
- Consumes: `get_json("espn:wnba:standings", ESPN_URL, ttl_seconds=CACHE_TTL_SECONDS, timeout_seconds=ESPN_TIMEOUT_SECONDS)`

- [ ] **Step 1: Replace `fetch_espn_standings`**

```python
from app.core.outbound_cache import get_json

async def fetch_espn_standings() -> dict:
    payload = await get_json(
        "espn:wnba:standings",
        ESPN_URL,
        ttl_seconds=CACHE_TTL_SECONDS,
        timeout_seconds=ESPN_TIMEOUT_SECONDS,
    )
    return payload if isinstance(payload, dict) else {}
```

Drop unused `httpx` import from this file if nothing else uses it.

- [ ] **Step 2: Run standings tests**

```bash
cd backend
python -m pytest tests/test_wnba_standings_normalize.py tests/test_wnba_standings_route.py -v
```

Expected: PASS

- [ ] **Step 3: Commit only if the user asks**

---

### Task 5: Wire WNBA ESPN roster + teams index

**Files:**
- Modify: `backend/app/providers/espn/wnba_roster.py`
- Possibly update: `backend/tests/test_wnba_espn_roster.py`, `backend/tests/test_wnba_team_preview.py`

**Interfaces:**
- `get_json(f"espn:wnba:roster:{team_id}", ..., ttl_seconds=900)`
- `get_json("espn:wnba:teams", ESPN_TEAMS_URL, ttl_seconds=3600)`

- [ ] **Step 1: Update roster fetch helpers**

Add constants and imports:

```python
from app.core.outbound_cache import get_json

ROSTER_OUTBOUND_TTL_SECONDS = 900.0
TEAMS_OUTBOUND_TTL_SECONDS = 3600.0
```

Replace `fetch_espn_roster`:

```python
async def fetch_espn_roster(team_id: str) -> dict:
    url = ESPN_ROSTER_URL.format(team_id=team_id)
    payload = await get_json(
        f"espn:wnba:roster:{team_id}",
        url,
        ttl_seconds=ROSTER_OUTBOUND_TTL_SECONDS,
        timeout_seconds=ESPN_TIMEOUT_SECONDS,
    )
    return payload if isinstance(payload, dict) else {}
```

In `build_wnba_player_index`, fetch teams + each roster via `get_json` with the keys/TTLs above; keep per-team `logger.warning` on failure. Remove unused client ownership if no longer needed.

- [ ] **Step 2: Run roster / team-preview tests**

```bash
cd backend
python -m pytest tests/test_wnba_espn_roster.py tests/test_wnba_team_preview.py -v
```

Expected: PASS

- [ ] **Step 3: Commit only if the user asks**

---

### Task 6: Docs + full verification

**Files:**
- Modify: `md/system-design.md`

- [ ] **Step 1: Document outbound cache**

On WNBA standings (and team-preview/roster notes if present), note ESPN JSON is served via `app.core.outbound_cache` (memory + `data/cache/outbound`, TTL + SWR). Source remains ESPN.

- [ ] **Step 2: Run related suite**

```bash
cd backend
python -m pytest tests/test_outbound_cache.py tests/test_wnba_standings_normalize.py tests/test_wnba_standings_route.py tests/test_wnba_espn_roster.py tests/test_wnba_team_preview.py -v
```

Expected: all PASS

- [ ] **Step 3: Optional manual smoke**

Warm standings once, restart backend, confirm disk envelope exists under `backend/data/cache/outbound/` and standings still works when ESPN 403s.

- [ ] **Step 4: Commit only if the user asks**

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Memory + disk store | 1 |
| Explicit TTLs | 1, 4, 5 |
| Coalescing | 1–2 |
| Rate limit + backoff | 1, 3 |
| SWR | 1–2 |
| Standings wiring | 4 |
| Roster + teams wiring | 5 |
| system-design note | 6 |
| Unit tests from spec | 1–3 |
| ETag / Supabase / other domains | Out of scope |

## Placeholder / consistency self-review

- `get_json` signature matches spec
- Keys: `espn:wnba:standings`, `espn:wnba:roster:{id}`, `espn:wnba:teams`
- Roster TTL 900s, teams 3600s, standings uses `CACHE_TTL_SECONDS` (600)
- Backoff initial 30s, cap 600s, min interval 1s
- Commits gated on explicit user request
