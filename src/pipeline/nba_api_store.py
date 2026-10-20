"""Upsert NBA pipeline frames into schema nba_api."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.utils.db import upsert_df

SCHEMA = "nba_api"


@dataclass(frozen=True)
class _Target:
    table: str
    conflict_cols: tuple[str, ...]
    lineage_col: str


_BRONZE: dict[str, _Target] = {
    "player_base": _Target("player_base", ("game_id", "player_id"), "fetched_at"),
    "player_adv": _Target("player_adv", ("game_id", "player_id"), "fetched_at"),
    "team_base": _Target("team_base", ("game_id", "team_id"), "fetched_at"),
    "team_adv": _Target("team_adv", ("game_id", "team_id"), "fetched_at"),
    "start_positions": _Target(
        "start_positions",
        ("game_id", "player_id"),
        "fetched_at",
    ),
}

_SILVER = _Target("player_gamelogs", ("game_id", "player_id"), "built_at")


def upsert_nba_dataset(dataset: str, frame: pd.DataFrame) -> None:
    target = _BRONZE.get(dataset)
    if target is None:
        known = ", ".join(_BRONZE)
        raise ValueError(
            f"Unknown NBA dataset {dataset!r}. Choose from: {known}"
        )
    _upsert(target, frame)


def upsert_nba_silver(frame: pd.DataFrame) -> None:
    _upsert(_SILVER, frame)


def _upsert(target: _Target, frame: pd.DataFrame) -> None:
    if frame.empty:
        return

    upsert_df(
        target.table,
        frame,
        schema=SCHEMA,
        conflict_cols=list(target.conflict_cols),
        lineage_col=target.lineage_col,
        postgres_only=True,
    )
