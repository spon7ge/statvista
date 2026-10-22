import asyncio

import app.providers.rotowire.nba_lineups as rw


def _five(prefix: str) -> list[dict[str, str]]:
    return [{"name": f"{prefix}{i}", "position": "G"} for i in range(5)]


def test_get_rotowire_starters_maps_espn_abbrevs(monkeypatch):
    """ESPN scoreboard tricodes differ from RotoWire lineup abbreviations."""
    rw.clear_rotowire_lineups_cache()
    by_abbr = {
        "GSW": _five("Gsw"),
        "LAL": _five("Lal"),
        "UTA": _five("Uta"),
        "MEM": _five("Mem"),
        "NOP": _five("Nop"),
        "NYK": _five("Nyk"),
        "SAS": _five("Sas"),
        "PHX": _five("Phx"),
        "WAS": _five("Was"),
    }
    monkeypatch.setattr(rw, "_scrape_starters_by_abbr", lambda: by_abbr)

    cases = (
        ("GS", "LAL", "Gsw0", "Lal0"),
        ("UTAH", "MEM", "Uta0", "Mem0"),
        ("NO", "NY", "Nop0", "Nyk0"),
        ("SA", "PHO", "Sas0", "Phx0"),
        ("WSH", "GSW", "Was0", "Gsw0"),
    )
    for away, home, away_name, home_name in cases:
        rw.clear_rotowire_lineups_cache()
        result = asyncio.run(
            rw.get_rotowire_starters_for_matchup(away_abbr=away, home_abbr=home)
        )
        assert result is not None, f"{away} @ {home}"
        assert result["away"][0]["name"] == away_name
        assert result["home"][0]["name"] == home_name
