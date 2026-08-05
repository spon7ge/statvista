"""Public response schemas for the WNBA domain."""

from app.domains.wnba.schemas_futures import (
    WnbaFuturesEntry,
    WnbaFuturesMarket,
    WnbaFuturesResponse,
)
from app.domains.wnba.schemas_game_detail import (
    GameDetailBoxScore,
    GameDetailBoxScorePlayer,
    GameDetailInjuries,
    GameDetailInjury,
    GameDetailLatestPlay,
    GameDetailMatchupPrediction,
    GameDetailPlay,
    GameDetailProjectedStarters,
    GameDetailSeasonLeader,
    GameDetailSeasonLeaders,
    GameDetailShot,
    GameDetailStarter,
    GameDetailTeam,
    GameDetailTeamStat,
    GameDetailWinProbability,
    GameDetailWinProbabilityPoint,
    WnbaGameDetail,
)
from app.domains.wnba.schemas_leaders import (
    WnbaLeaderCategory,
    WnbaLeaderRow,
    WnbaLeadersResponse,
)
from app.domains.wnba.schemas_player import (
    WnbaPlayerAverages,
    WnbaPlayerGame,
    WnbaPlayerResponse,
)
from app.domains.wnba.schemas_scoreboard import (
    GameStatus,
    WnbaGame,
    WnbaScoreboardResponse,
    WnbaTeam,
)
from app.domains.wnba.schemas_standings import (
    WnbaStandingsConference,
    WnbaStandingsResponse,
    WnbaStandingsRow,
)

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
    "PROP_SPORTSBOOKS",
    "WnbaFuturesEntry",
    "WnbaFuturesMarket",
    "WnbaFuturesResponse",
    "WnbaGame",
    "WnbaGameDetail",
    "WnbaLeaderCategory",
    "WnbaLeaderRow",
    "WnbaLeadersResponse",
    "WnbaOddsGame",
    "WnbaOddsResponse",
    "WnbaPlayerAverages",
    "WnbaPlayerGame",
    "WnbaPlayerResponse",
    "WnbaPropBookQuote",
    "WnbaPropLine",
    "WnbaPropsResponse",
    "WnbaScoreboardResponse",
    "WnbaStandingsConference",
    "WnbaStandingsResponse",
    "WnbaStandingsRow",
    "WnbaTeam",
]
