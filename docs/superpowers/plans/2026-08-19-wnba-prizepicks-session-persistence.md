# WNBA PrizePicks Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist PrizePicks session cookies and Playwright `storage_state` in `wnba_prizepick.py` so ~30-minute runs usually succeed on HTTP after one headed captcha solve.

**Architecture:** Port MLB’s auto-managed cookie file into the WNBA scraper, add a Playwright storage-state JSON file, load both on subsequent runs, and refresh both after a successful browser clearance. Optional `PRIZEPICKS_PROXY` wires into HTTP + Playwright when set.

**Tech Stack:** Python 3, requests, curl_cffi (optional), playwright (optional), pytest

## Global Constraints

- Scope: `src/scrapers/wnba_prizepick.py` + new unit tests only (do not change `mlb_prizepick.py` in this plan)
- Default artifacts under `data/props/prizepicks/`: `.session_cookie.txt` and `.playwright_storage.json`
- Shared default cookie path with MLB is intentional
- Headed Playwright by default; `PRIZEPICKS_HEADLESS` truthy → headless
- No live PrizePicks network in CI tests
- Do not commit unless the user explicitly asks
- Product name remains **statvista** in any user-facing copy (scraper logs are fine as-is)

---

## File Structure

- Modify: `src/scrapers/wnba_prizepick.py` — cookie/storage/proxy helpers; wire into HTTP + Playwright
- Create: `src/scrapers/tests/scrapers/test_wnba_prizepick_session.py` — unit tests for path/cookie/storage helpers (no live network)
- Spec (already written): `docs/superpowers/specs/2026-08-19-wnba-prizepicks-session-persistence-design.md`

---

### Task 1: Cookie + storage path helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_wnba_prizepick_session.py`
- Modify: `src/scrapers/wnba_prizepick.py` (config + cookie helpers near existing `get_cookie_for_request`)

**Interfaces:**
- Produces: `_DEFAULT_COOKIE_FILE: str`
- Produces: `_DEFAULT_STORAGE_STATE_FILE: str`
- Produces: `cookie_file_path() -> str`
- Produces: `storage_state_path() -> str`
- Produces: `get_cookie_for_request() -> str` (updated to auto-load default file)
- Produces: `save_session_cookie(cookie_header: str, path: str | None = None) -> None`
- Produces: `_build_cookie_header_from_playwright(cookies: list[dict[str, Any]]) -> str`
- Produces: `proxy_from_env() -> str | None`

- [ ] **Step 1: Write failing tests**

Create `src/scrapers/tests/scrapers/test_wnba_prizepick_session.py`:

```python
"""Unit tests for WNBA PrizePicks session persistence helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SCRAPER_PATH = (
    Path(__file__).resolve().parents[2] / "wnba_prizepick.py"
)


def _load_scraper():
    spec = importlib.util.spec_from_file_location("wnba_prizepick", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["wnba_prizepick"] = mod
    spec.loader.exec_module(mod)
    return mod


pp = _load_scraper()


class TestCookieFilePath:
    def test_default_under_prizepicks_dir(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_COOKIE_FILE", raising=False)
        path = pp.cookie_file_path()
        assert path.endswith(".session_cookie.txt")
        assert "prizepicks" in path.replace("\\", "/")

    def test_explicit_env_override(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        target = tmp_path / "custom_cookie.txt"
        monkeypatch.setenv("PRIZEPICKS_COOKIE_FILE", str(target))
        assert pp.cookie_file_path() == str(target)


class TestStorageStatePath:
    def test_default_under_prizepicks_dir(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_STORAGE_STATE", raising=False)
        path = pp.storage_state_path()
        assert path.endswith(".playwright_storage.json")
        assert "prizepicks" in path.replace("\\", "/")

    def test_explicit_env_override(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        target = tmp_path / "state.json"
        monkeypatch.setenv("PRIZEPICKS_STORAGE_STATE", str(target))
        assert pp.storage_state_path() == str(target)


class TestGetCookieForRequest:
    def test_env_wins_over_file(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        cookie_file = tmp_path / ".session_cookie.txt"
        cookie_file.write_text("from_file=1\n", encoding="utf-8")
        monkeypatch.setenv("PRIZEPICKS_COOKIE", "from_env=1")
        monkeypatch.setenv("PRIZEPICKS_COOKIE_FILE", str(cookie_file))
        assert pp.get_cookie_for_request() == "from_env=1"

    def test_loads_auto_file_without_env(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        cookie_file = tmp_path / ".session_cookie.txt"
        cookie_file.write_text("datadome=abc; session=xyz\n", encoding="utf-8")
        monkeypatch.delenv("PRIZEPICKS_COOKIE", raising=False)
        monkeypatch.setenv("PRIZEPICKS_COOKIE_FILE", str(cookie_file))
        assert pp.get_cookie_for_request() == "datadome=abc; session=xyz"


class TestSaveAndBuildCookie:
    def test_save_session_cookie_writes_file(self, tmp_path: Path) -> None:
        target = tmp_path / "out.txt"
        pp.save_session_cookie("a=1; b=2", path=str(target))
        assert target.read_text(encoding="utf-8").strip() == "a=1; b=2"

    def test_build_cookie_header_filters_domain(self) -> None:
        cookies = [
            {"name": "dd", "value": "1", "domain": ".prizepicks.com"},
            {"name": "other", "value": "2", "domain": "example.com"},
            {"name": "sess", "value": "3", "domain": "api.prizepicks.com"},
        ]
        header = pp._build_cookie_header_from_playwright(cookies)
        assert "dd=1" in header
        assert "sess=3" in header
        assert "other=2" not in header


class TestProxyFromEnv:
    def test_absent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_PROXY", raising=False)
        assert pp.proxy_from_env() is None

    def test_present(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PRIZEPICKS_PROXY", "http://user:pass@host:8000")
        assert pp.proxy_from_env() == "http://user:pass@host:8000"
```

Note: `_SCRAPER_PATH` resolves to `src/scrapers/wnba_prizepick.py` because this test file lives at `src/scrapers/tests/scrapers/test_wnba_prizepick_session.py` (`parents[2]` = `src/scrapers`).

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/scrapers/test_wnba_prizepick_session.py -v
```

Expected: FAIL with `AttributeError` / missing `cookie_file_path` (or import errors for new helpers).

- [ ] **Step 3: Implement helpers in `wnba_prizepick.py`**

Add near config (after `_DEFAULT_OUTPUT_DIR`):

```python
_DEFAULT_COOKIE_FILE = os.path.join(_DEFAULT_OUTPUT_DIR, ".session_cookie.txt")
_DEFAULT_STORAGE_STATE_FILE = os.path.join(
    _DEFAULT_OUTPUT_DIR, ".playwright_storage.json"
)
```

Replace `get_cookie_for_request` and add helpers matching MLB (`cookie_file_path`, `save_session_cookie`, `_build_cookie_header_from_playwright`) plus:

```python
def storage_state_path() -> str:
    """Resolve Playwright storage_state JSON path (env override or default)."""
    explicit = os.environ.get("PRIZEPICKS_STORAGE_STATE", "").strip()
    if explicit:
        return os.path.expanduser(explicit)
    return _DEFAULT_STORAGE_STATE_FILE


def proxy_from_env() -> str | None:
    """Optional proxy URL for HTTP and Playwright (`PRIZEPICKS_PROXY`)."""
    raw = os.environ.get("PRIZEPICKS_PROXY", "").strip()
    return raw or None
```

Update module docstring to document:
- Auto cookie + storage state files
- `PRIZEPICKS_STORAGE_STATE`
- `PRIZEPICKS_PROXY`
- Occasional captcha when session expires

- [ ] **Step 4: Run tests to verify they pass**

Run the same pytest command as Step 2.  
Expected: PASS for all tests in the new file.

- [ ] **Step 5: Commit only if user asks** — skip by default

---

### Task 2: Wire proxy + Playwright persistence

**Files:**
- Modify: `src/scrapers/wnba_prizepick.py` (`_http_get_json` callers / `try_fetch_with_curl_cffi`, `try_fetch_with_requests`, `try_fetch_with_playwright`, `build_fetch_failure_message`)

**Interfaces:**
- Consumes: `cookie_file_path`, `storage_state_path`, `save_session_cookie`, `_build_cookie_header_from_playwright`, `proxy_from_env`
- Produces: Playwright path that loads/saves `storage_state`; HTTP paths that pass proxy when set

- [ ] **Step 1: Add a focused unit test for storage load decision helper (optional thin wrapper)**

If useful for TDD without launching Playwright, add:

```python
def storage_state_for_context(path: str | None = None) -> str | None:
    """Return storage_state path if the file exists; else None."""
    target = path or storage_state_path()
    return target if os.path.isfile(target) else None
```

Test:

```python
class TestStorageStateForContext:
    def test_missing_returns_none(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        missing = tmp_path / "nope.json"
        monkeypatch.setenv("PRIZEPICKS_STORAGE_STATE", str(missing))
        assert pp.storage_state_for_context() is None

    def test_existing_returns_path(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        present = tmp_path / "state.json"
        present.write_text("{}", encoding="utf-8")
        monkeypatch.setenv("PRIZEPICKS_STORAGE_STATE", str(present))
        assert pp.storage_state_for_context() == str(present)
```

- [ ] **Step 2: Run new tests — expect FAIL, then implement `storage_state_for_context`**

- [ ] **Step 3: Wire proxy into HTTP fetchers**

In `try_fetch_with_curl_cffi` and `try_fetch_with_requests`, after building headers:

```python
proxy = proxy_from_env()
# curl_cffi:
get_kwargs = {"impersonate": profile}
if proxy:
    get_kwargs["proxy"] = proxy
# requests:
get_kwargs = {}
if proxy:
    get_kwargs["proxies"] = {"http": proxy, "https": proxy}
```

Pass `get_kwargs` into `_http_get_json` (already supports `get_kwargs`).

- [ ] **Step 4: Update `try_fetch_with_playwright`**

Replace the empty-context launch block with logic equivalent to:

```python
proxy = proxy_from_env()
launch_kwargs: dict[str, Any] = {"headless": headless}
# Prefer proxy on context; Playwright also accepts proxy on launch.
context_kwargs: dict[str, Any] = {}
state = storage_state_for_context()
if state:
    context_kwargs["storage_state"] = state
    logger.info(f"Reusing Playwright storage_state from {state}")
if proxy:
    context_kwargs["proxy"] = {"server": proxy}
    logger.info("Using PRIZEPICKS_PROXY for Playwright")

browser = p.chromium.launch(**launch_kwargs)
context = browser.new_context(**context_kwargs)
# ... existing goto / poll / fetch loop ...

# After clearance success, before fetching leagues (or after all leagues succeed):
try:
    cookie_header = _build_cookie_header_from_playwright(context.cookies())
    if cookie_header:
        save_session_cookie(cookie_header)
    state_path = storage_state_path()
    parent = os.path.dirname(os.path.abspath(state_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    context.storage_state(path=state_path)
    logger.info(f"✓ Saved Playwright storage_state to {state_path}")
except Exception as e:
    logger.debug(f"Could not persist session/storage: {e}")
```

Keep existing captcha wait / league fetch behavior. Increase evaluate timeout if MLB did (optional; WNBA payloads are smaller — leave default unless flaky).

- [ ] **Step 5: Update `build_fetch_failure_message` troubleshooting**

Add bullets for auto-managed cookie/storage files and optional `PRIZEPICKS_PROXY`. Keep DataDome + Playwright install guidance.

- [ ] **Step 6: Run unit tests**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python -m pytest src/scrapers/tests/scrapers/test_wnba_prizepick_session.py -v
```

Expected: all PASS.

- [ ] **Step 7: Commit only if user asks** — skip by default

---

### Task 3: Manual smoke checklist (local)

**Files:** none (operator steps)

- [ ] **Step 1: Headed first run (if no valid session)**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/src/scrapers && python wnba_prizepick.py
```

If DataDome appears, solve captcha in the window.  
Expected logs include saving `.session_cookie.txt` and `.playwright_storage.json`.

- [ ] **Step 2: Immediate second run**

Re-run the same command within a few minutes.  
Expected: curl_cffi or requests succeeds using the cookie; Playwright skipped if HTTP works.

- [ ] **Step 3: Report outcome to user** (pass/fail + whether HTTP reused session)

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Auto cookie file like MLB | Task 1 |
| Playwright `storage_state` load/save | Task 2 |
| Prefer HTTP with cookie; Playwright fallback | existing flow + Task 2 persistence |
| Optional `PRIZEPICKS_PROXY` | Task 2 |
| Docstring / troubleshooting updates | Task 1–2 |
| Unit tests, no live network | Task 1–2 |
| Manual smoke | Task 3 |
| No MLB file changes / no Airflow | Global Constraints |

Placeholder scan: none.  
Type consistency: `storage_state_path() -> str`, `storage_state_for_context() -> str | None`, `proxy_from_env() -> str | None`.
