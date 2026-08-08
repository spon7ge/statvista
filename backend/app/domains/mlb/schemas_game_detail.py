from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domains.mlb.schemas_scoreboard import GameStatus

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

__all__ = [
    "GameStatus",
    "MlbBatterRow",
    "MlbBoxScore",
    "MlbDecisions",
    "MlbGameDetail",
    "MlbGameDetailTeam",
    "MlbGameUmpires",
    "MlbGameWeather",
    "MlbHitPoint",
    "MlbLinescore",
    "MlbLinescoreInning",
    "MlbLinescoreTotals",
    "MlbPitch",
    "MlbPitcherRow",
    "MlbPlay",
    "MlbPlayerCard",
    "MlbRunners",
    "MlbSituation",
    "MlbInjuries",
    "MlbInjury",
    "MlbSeasonTeamStatLine",
    "MlbSeasonTeamStatsPair",
    "MlbTeamStatLine",
    "MlbTeamStatsPair",
    "MlbWinProbability",
    "MlbWinProbabilityPoint",
    "MlbWinProbabilityStakes",
]


class MlbGameDetailTeam(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: str
    abbrev: str
    name: str
    score: int | None
    color: str
    logo_url: str | None = None
    record: str | None = None
    last_10: str | None = None


class MlbDecisions(BaseModel):
    model_config = _RESPONSE_CONFIG

    winner: str | None = None
    loser: str | None = None
    save: str | None = None


class MlbTeamStatLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    hr: int | None = None
    r: int | None = None
    h: int | None = None
    sb: int | None = None
    lob: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    era: str | None = None
    k: int | None = None


class MlbTeamStatsPair(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: MlbTeamStatLine
    home: MlbTeamStatLine


class MlbSeasonTeamStatLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    hr: int | None = None
    r: int | None = None
    h: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    era: str | None = None
    so: int | None = None
    bb: int | None = None


class MlbSeasonTeamStatsPair(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: MlbSeasonTeamStatLine
    home: MlbSeasonTeamStatLine


class MlbInjury(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str
    position: str | None = None
    status: str
    detail: str | None = None


class MlbInjuries(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: list[MlbInjury]
    home: list[MlbInjury]


class MlbLinescoreInning(BaseModel):
    model_config = _RESPONSE_CONFIG

    num: int
    away_runs: int | None
    home_runs: int | None


class MlbLinescoreTotals(BaseModel):
    model_config = _RESPONSE_CONFIG

    runs: int
    hits: int
    errors: int


class MlbLinescore(BaseModel):
    model_config = _RESPONSE_CONFIG

    innings: list[MlbLinescoreInning]
    away: MlbLinescoreTotals
    home: MlbLinescoreTotals
    current_inning: int | None
    inning_half: Literal["top", "bottom"] | None


class MlbPlayerCard(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str
    hand: str | None = None
    summary: str | None = None
    id: int | None = None
    headshot_url: str | None = None


class MlbPitch(BaseModel):
    model_config = _RESPONSE_CONFIG

    number: int
    type: str | None
    mph: float | None
    result: str | None
    is_strike: bool
    zone_x: float | None
    zone_y: float | None
    spin_rate: float | None = None
    spin_direction: float | None = None


class MlbRunners(BaseModel):
    model_config = _RESPONSE_CONFIG

    first: bool
    second: bool
    third: bool


class MlbSituation(BaseModel):
    model_config = _RESPONSE_CONFIG

    balls: int
    strikes: int
    outs: int
    runners: MlbRunners
    at_bat: MlbPlayerCard | None
    on_deck: MlbPlayerCard | None
    pitching: MlbPlayerCard | None
    pitches: list[MlbPitch]
    latest_play_text: str | None = None


class MlbPlay(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: str
    inning: int
    half: Literal["top", "bottom"]
    text: str
    scoring: bool
    away_score: int
    home_score: int
    event: str | None = None
    exit_velo: float | None = None
    launch_angle: float | None = None
    total_distance: float | None = None
    scoring_team: Literal["away", "home"] | None = None


class MlbBatterRow(BaseModel):
    model_config = _RESPONSE_CONFIG

    order: int | None
    name: str
    position: str | None
    ab: int | None
    r: int | None
    h: int | None
    rbi: int | None
    bb: int | None
    so: int | None
    hr: int | None = None
    sb: int | None = None


class MlbPitcherRow(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str
    ip: str | None
    h: int | None
    r: int | None
    er: int | None
    bb: int | None
    k: int | None
    pitches: int | None
    hr: int | None = None
    era: str | None = None
    decision: str | None = None
    strikes: int | None = None
    ground_outs: int | None = None
    fly_outs: int | None = None
    batters_faced: int | None = None
    inherited_runners: int | None = None
    inherited_runners_scored: int | None = None


class MlbBoxNoteLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    label: str
    value: str


class MlbPitchingTotals(BaseModel):
    model_config = _RESPONSE_CONFIG

    ip: str | None = None
    h: int | None = None
    r: int | None = None
    er: int | None = None
    bb: int | None = None
    k: int | None = None
    hr: int | None = None
    era: str | None = None


class MlbBoxScore(BaseModel):
    model_config = _RESPONSE_CONFIG

    away_batters: list[MlbBatterRow]
    home_batters: list[MlbBatterRow]
    away_pitchers: list[MlbPitcherRow]
    home_pitchers: list[MlbPitcherRow]
    away_batting_notes: list[MlbBoxNoteLine] = []
    home_batting_notes: list[MlbBoxNoteLine] = []
    away_baserunning_notes: list[MlbBoxNoteLine] = []
    home_baserunning_notes: list[MlbBoxNoteLine] = []
    away_fielding_notes: list[MlbBoxNoteLine] = []
    home_fielding_notes: list[MlbBoxNoteLine] = []
    away_pitching_totals: MlbPitchingTotals | None = None
    home_pitching_totals: MlbPitchingTotals | None = None


class MlbHitPoint(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: str
    team: Literal["away", "home"]
    result: Literal["hr", "hit", "out"]
    x: float
    y: float
    player_name: str | None = None
    # Human label for tooltip: Single, Double, Triple, HR, Flyout, etc.
    outcome: str | None = None


class MlbWinProbabilityPoint(BaseModel):
    model_config = _RESPONSE_CONFIG

    play_id: str
    label: str
    home_win_pct: float


class MlbWinProbabilityStakes(BaseModel):
    model_config = _RESPONSE_CONFIG

    home_win_delta: float
    label: str


class MlbWinProbability(BaseModel):
    model_config = _RESPONSE_CONFIG

    home_abbrev: str
    away_abbrev: str
    points: list[MlbWinProbabilityPoint]
    stakes: MlbWinProbabilityStakes | None = None


class MlbGameWeather(BaseModel):
    model_config = _RESPONSE_CONFIG

    condition: str | None = None
    temp_f: str | None = None
    wind: str | None = None


class MlbGameUmpires(BaseModel):
    model_config = _RESPONSE_CONFIG

    home_plate: str | None = None
    first_base: str | None = None
    second_base: str | None = None
    third_base: str | None = None


class MlbGameDetail(BaseModel):
    model_config = _RESPONSE_CONFIG

    mlb_game_pk: str
    league: Literal["mlb"] = "mlb"
    status: GameStatus
    status_label: str
    venue: str | None
    venue_city: str | None = None
    venue_state: str | None = None
    weather: MlbGameWeather | None = None
    umpires: MlbGameUmpires | None = None
    away: MlbGameDetailTeam
    home: MlbGameDetailTeam
    linescore: MlbLinescore | None = None
    situation: MlbSituation | None = None
    plays: list[MlbPlay] = []
    scoring_plays: list[MlbPlay] = []
    box_score: MlbBoxScore | None = None
    hit_chart: list[MlbHitPoint] = []
    win_probability: MlbWinProbability | None = None
    game_date: str | None = None
    game_date_label: str | None = None
    decisions: MlbDecisions | None = None
    team_stats: MlbTeamStatsPair | None = None
    season_team_stats: MlbSeasonTeamStatsPair | None = None
    injuries: MlbInjuries | None = None
    sources: list[str]
    fetched_at: str
