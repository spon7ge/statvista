from __future__ import annotations

from app.domains.betting.player_match_keys import (
    PLAYER_NAME_ALIASES,
    match_player_key,
    strong_norm_player_name,
)


def test_strong_norm_strips_accents():
    assert strong_norm_player_name("Janelle Salaün") == "janelle salaun"
    assert strong_norm_player_name("Laura Juškaitė") == "laura juskaite"
    assert strong_norm_player_name("Leïla Lacan") == "leila lacan"
    assert strong_norm_player_name("Janelle Salaun") == "janelle salaun"


def test_strong_norm_preserves_apostrophe():
    assert strong_norm_player_name("A'ja Wilson") == "a'ja wilson"


def test_strong_norm_collapses_whitespace():
    assert strong_norm_player_name("  Caitlin   Clark  ") == "caitlin clark"


def test_strong_norm_empty():
    assert strong_norm_player_name("") == ""
    assert strong_norm_player_name("   ") == ""


def test_match_player_key_alias_middle_name():
    assert match_player_key("Jessica Lynn Shepard") == "jessica shepard"
    assert match_player_key("Jessica Shepard") == "jessica shepard"


def test_match_player_key_without_alias_is_strong_norm():
    assert match_player_key("Janelle Salaün") == "janelle salaun"


def test_aliases_are_strong_normed_and_unique():
    assert len(PLAYER_NAME_ALIASES) == len(set(PLAYER_NAME_ALIASES))
    for src, dst in PLAYER_NAME_ALIASES.items():
        assert src == strong_norm_player_name(src)
        assert dst == strong_norm_player_name(dst)
        assert src != dst


def test_combo_name_is_not_aliased_to_solo():
    key = match_player_key("Gabby Williams + Kayla McBride")
    assert "+" in key or " + " in key
    assert key != match_player_key("Gabby Williams")
