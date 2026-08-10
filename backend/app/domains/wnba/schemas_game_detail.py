from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domains.wnba.schemas_scoreboard import GameStatus

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

__all__ = [
    "GameDetailBoxScore",
    "GameDetailBoxScorePlayer",
    "GameDetailInjuries",
    "GameDetailInjury",
    "GameDetailLatestPlay",
    "GameDetailMatchupPrediction",
    "GameDetailPlay",
    "GameDetailProjectedStarters",
    "GameDetailSeasonLeader",
    "GameDetailSeasonLeaders",
    "GameDetailShot",
    "GameDetailStarter",
    "GameDetailTeam",
    "GameDetailTeamStat",
    "GameDetailWinProbability",
    "GameDetailWinProbabilityPoint",
    "GameStatus",
    "WnbaGameDetail",
    "WnbaGameLeaderCard",
    "WnbaGameLeaders",
    "WnbaSeasonTeamStatLine",
    "WnbaSeasonTeamStatsPair",
]


class GameDetailTeam(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: str
    abbrev: str
    name: str
    score: int | None
    color: str
    logo_url: str | None = None
    record: str | None = None
    last_10: str | None = None


class WnbaSeasonTeamStatLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    pts: float | None = None
    fg_pct: str | None = None
    fg3_pct: str | None = None
    ft_pct: str | None = None
    reb: float | None = None
    ast: float | None = None
    stl: float | None = None
    blk: float | None = None
    to: float | None = None
    pts_rank: int | None = None
    fg_pct_rank: int | None = None
    fg3_pct_rank: int | None = None
    ft_pct_rank: int | None = None
    reb_rank: int | None = None
    ast_rank: int | None = None
    stl_rank: int | None = None
    blk_rank: int | None = None
    to_rank: int | None = None


class WnbaSeasonTeamStatsPair(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: WnbaSeasonTeamStatLine
    home: WnbaSeasonTeamStatLine


class WnbaGameLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG

    key: Literal["ppg", "rpg", "apg"]
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    team_abbrev: str
    side: Literal["away", "home"]
    headshot_url: str | None = None


class WnbaGameLeaders(BaseModel):
    model_config = _RESPONSE_CONFIG

    leaders: list[WnbaGameLeaderCard]


class GameDetailShot(BaseModel):
    id: str
    team_id: str
    player_name: str
    made: bool
    x: float
    y: float
    period: int
    clock: str


class GameDetailPlay(BaseModel):
    id: str
    team_id: str | None
    period: int
    clock: str
    text: str
    scoring: bool
    away_score: int
    home_score: int
    shooting: bool


class GameDetailLatestPlay(BaseModel):
    id: str
    clock: str
    period: int
    text: str
    team_id: str | None


class GameDetailWinProbabilityPoint(BaseModel):
    id: str
    period: int
    clock: str
    away_score: int
    home_score: int
    away_win_pct: int
    home_win_pct: int
    team_id: str | None


class GameDetailTeamStat(BaseModel):
    key: str
    label: str
    away_value: int
    home_value: int


class GameDetailWinProbability(BaseModel):
    summary: str | None
    timeline: list[GameDetailWinProbabilityPoint]
    team_stats: list[GameDetailTeamStat]


class GameDetailMatchupPrediction(BaseModel):
    away_win_pct: int
    home_win_pct: int
    source_label: str


class GameDetailStarter(BaseModel):
    jersey: str | None
    name: str
    position: str | None
    gtd: bool = False


class GameDetailProjectedStarters(BaseModel):
    note: str
    away: list[GameDetailStarter]
    home: list[GameDetailStarter]


class GameDetailSeasonLeader(BaseModel):
    stat: Literal["points", "assists", "rebounds"]
    label: str
    name: str
    value: str


class GameDetailSeasonLeaders(BaseModel):
    away: list[GameDetailSeasonLeader]
    home: list[GameDetailSeasonLeader]


class GameDetailInjury(BaseModel):
    name: str
    position: str | None
    status: str
    detail: str | None


class GameDetailInjuries(BaseModel):
    away: list[GameDetailInjury]
    home: list[GameDetailInjury]


class GameDetailBoxScorePlayer(BaseModel):
    name: str
    did_not_play: bool
    values: list[str]


class GameDetailBoxScore(BaseModel):
    columns: list[str]
    away: list[GameDetailBoxScorePlayer]
    home: list[GameDetailBoxScorePlayer]


class WnbaGameDetail(BaseModel):
    espn_event_id: str
    league: Literal["wnba"] = "wnba"
    status: GameStatus
    status_label: str
    venue: str | None
    away: GameDetailTeam
    home: GameDetailTeam
    fg_made: int
    fg_attempted: int
    latest_play: GameDetailLatestPlay | None
    shots: list[GameDetailShot]
    plays: list[GameDetailPlay]
    win_probability: GameDetailWinProbability | None
    matchup_prediction: GameDetailMatchupPrediction | None
    projected_starters: GameDetailProjectedStarters | None
    season_leaders: GameDetailSeasonLeaders | None
    season_team_stats: WnbaSeasonTeamStatsPair | None = None
    game_leaders: WnbaGameLeaders | None = None
    injuries: GameDetailInjuries | None
    box_score: GameDetailBoxScore | None
    fetched_at: str
