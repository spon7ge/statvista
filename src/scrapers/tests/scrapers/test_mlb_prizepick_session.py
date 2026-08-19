"""Unit tests for MLB PrizePicks session persistence helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SCRAPER_PATH = (
    Path(__file__).resolve().parents[2] / "mlb_prizepick.py"
)


def _load_scraper():
    spec = importlib.util.spec_from_file_location("mlb_prizepick", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mlb_prizepick"] = mod
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


class TestPlaywrightProxyKwargs:
    def test_splits_userinfo(self) -> None:
        assert pp.playwright_proxy_kwargs("http://user:pass@host:8000") == {
            "server": "http://host:8000",
            "username": "user",
            "password": "pass",
        }

    def test_no_userinfo(self) -> None:
        assert pp.playwright_proxy_kwargs("http://host:8000") == {
            "server": "http://host:8000",
        }


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

    def test_invalid_json_returns_none(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        present = tmp_path / "state.json"
        present.write_text("not-json{{{", encoding="utf-8")
        monkeypatch.setenv("PRIZEPICKS_STORAGE_STATE", str(present))
        assert pp.storage_state_for_context() is None

    def test_empty_file_returns_none(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        present = tmp_path / "state.json"
        present.write_text("", encoding="utf-8")
        monkeypatch.setenv("PRIZEPICKS_STORAGE_STATE", str(present))
        assert pp.storage_state_for_context() is None


class TestProfileDirPath:
    def test_default_under_prizepicks_dir(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_PROFILE_DIR", raising=False)
        path = pp.profile_dir_path()
        assert path.endswith(".pw_profile")
        assert "prizepicks" in path.replace("\\", "/")

    def test_explicit_env_override(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        target = tmp_path / "chrome_profile"
        monkeypatch.setenv("PRIZEPICKS_PROFILE_DIR", str(target))
        assert pp.profile_dir_path() == str(target)


class TestPlaywrightChannelFromEnv:
    def test_unset_means_auto(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_CHANNEL", raising=False)
        assert pp.playwright_channel_from_env() is None

    @pytest.mark.parametrize("value", ["0", "off", "false", "chromium", "bundled"])
    def test_bundled_chromium(self, monkeypatch: pytest.MonkeyPatch, value: str) -> None:
        monkeypatch.setenv("PRIZEPICKS_CHANNEL", value)
        assert pp.playwright_channel_from_env() is None

    def test_custom_channel(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PRIZEPICKS_CHANNEL", "chrome-beta")
        assert pp.playwright_channel_from_env() == "chrome-beta"


class TestResolvePlaywrightBrowser:
    def test_executable_env_wins(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        exe = tmp_path / "Brave Browser"
        exe.write_text("", encoding="utf-8")
        exe.chmod(0o755)
        monkeypatch.setenv("PRIZEPICKS_EXECUTABLE", str(exe))
        monkeypatch.delenv("PRIZEPICKS_CHANNEL", raising=False)
        assert pp.resolve_playwright_browser() == (None, str(exe))

    def test_explicit_channel(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_EXECUTABLE", raising=False)
        monkeypatch.setenv("PRIZEPICKS_CHANNEL", "msedge")
        assert pp.resolve_playwright_browser() == ("msedge", None)

    def test_force_bundled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_EXECUTABLE", raising=False)
        monkeypatch.setenv("PRIZEPICKS_CHANNEL", "chromium")
        assert pp.resolve_playwright_browser() == (None, None)

    def test_auto_prefers_detected(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        monkeypatch.delenv("PRIZEPICKS_EXECUTABLE", raising=False)
        monkeypatch.delenv("PRIZEPICKS_CHANNEL", raising=False)
        fake = str(tmp_path / "Brave Browser")
        Path(fake).write_text("", encoding="utf-8")
        Path(fake).chmod(0o755)
        monkeypatch.setattr(pp, "_SYSTEM_CHROMIUM_CANDIDATES", (fake,))
        assert pp.resolve_playwright_browser() == (None, fake)

    def test_auto_falls_back_to_chrome_channel(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PRIZEPICKS_EXECUTABLE", raising=False)
        monkeypatch.delenv("PRIZEPICKS_CHANNEL", raising=False)
        monkeypatch.setattr(pp, "_SYSTEM_CHROMIUM_CANDIDATES", ())
        assert pp.resolve_playwright_browser() == ("chrome", None)


class TestCdpUrlFromEnv:
    def test_absent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_CDP_URL", raising=False)
        monkeypatch.delenv("PRIZEPICKS_CDP", raising=False)
        assert pp.cdp_url_from_env() is None

    def test_explicit_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PRIZEPICKS_CDP_URL", "http://127.0.0.1:9333")
        assert pp.cdp_url_from_env() == "http://127.0.0.1:9333"

    def test_flag_defaults_port(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_CDP_URL", raising=False)
        monkeypatch.setenv("PRIZEPICKS_CDP", "1")
        assert pp.cdp_url_from_env() == "http://127.0.0.1:9222"


class TestBraveCdpLaunchCommand:
    def test_includes_port_and_profile(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PRIZEPICKS_PROFILE_DIR", raising=False)
        cmd = pp.brave_cdp_launch_command(port=9222)
        assert "--remote-debugging-port=9222" in cmd
        assert ".pw_profile" in cmd
        assert "app.prizepicks.com" in cmd
