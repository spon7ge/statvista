"""IANA timezone keys must resolve; Windows needs the tzdata package."""

from zoneinfo import ZoneInfo


def test_iana_timezone_keys_resolve() -> None:
    assert ZoneInfo("America/Los_Angeles").key == "America/Los_Angeles"
    assert ZoneInfo("America/New_York").key == "America/New_York"
