export type GameStatus = "scheduled" | "live" | "halftime" | "final";

export type GameDetailTeam = {
  id: string;
  abbrev: string;
  name: string;
  score: number | null;
  record: string | null;
  last10: string | null;
  color: string;
  logoUrl: string | null;
};

export type GameDetailSeasonTeamStatLine = {
  pts: number | null;
  ptsRank: number | null;
  fgPct: string | null;
  fgPctRank: number | null;
  fg3Pct: string | null;
  fg3PctRank: number | null;
  ftPct: string | null;
  ftPctRank: number | null;
  reb: number | null;
  rebRank: number | null;
  ast: number | null;
  astRank: number | null;
  stl: number | null;
  stlRank: number | null;
  blk: number | null;
  blkRank: number | null;
  to: number | null;
  toRank: number | null;
};

export type GameDetailSeasonTeamStats = {
  away: GameDetailSeasonTeamStatLine;
  home: GameDetailSeasonTeamStatLine;
};

export type GameDetailGameLeaderCard = {
  key: "ppg" | "rpg" | "apg";
  label: string;
  rank: number | null;
  value: string;
  playerId: string;
  lastName: string;
  teamAbbrev: string;
  side: "away" | "home";
  headshotUrl: string | null;
};

export type GameDetailGameLeaders = {
  leaders: GameDetailGameLeaderCard[];
};

export type GameDetailShot = {
  id: string;
  teamId: string;
  playerName: string;
  made: boolean;
  x: number;
  y: number;
  period: number;
  clock: string;
};

export type GameDetailPlay = {
  id: string;
  teamId: string | null;
  period: number;
  clock: string;
  text: string;
  scoring: boolean;
  awayScore: number;
  homeScore: number;
  shooting: boolean;
};

export type GameDetailLatestPlay = {
  id: string;
  clock: string;
  period: number;
  text: string;
  teamId: string | null;
};

export type GameDetailWinProbabilityPoint = {
  id: string;
  period: number;
  clock: string;
  awayScore: number;
  homeScore: number;
  awayWinPct: number;
  homeWinPct: number;
  teamId: string | null;
};

export type GameDetailTeamStat = {
  key: string;
  label: string;
  awayValue: number;
  homeValue: number;
};

export type GameDetailWinProbability = {
  summary: string | null;
  timeline: GameDetailWinProbabilityPoint[];
  teamStats: GameDetailTeamStat[];
};

export type GameDetailMatchupPrediction = {
  awayWinPct: number;
  homeWinPct: number;
  sourceLabel: string;
};

export type GameDetailStarter = {
  jersey: string | null;
  name: string;
  position: string | null;
  gtd: boolean;
};

export type GameDetailProjectedStarters = {
  note: string;
  away: GameDetailStarter[];
  home: GameDetailStarter[];
};

export type GameDetailSeasonLeader = {
  stat: "points" | "assists" | "rebounds";
  label: string;
  name: string;
  value: string;
};

export type GameDetailSeasonLeaders = {
  away: GameDetailSeasonLeader[];
  home: GameDetailSeasonLeader[];
};

export type GameDetailInjury = {
  name: string;
  position: string | null;
  status: string;
  detail: string | null;
};

export type GameDetailInjuries = {
  away: GameDetailInjury[];
  home: GameDetailInjury[];
};

export type GameDetailBoxScorePlayer = {
  name: string;
  didNotPlay: boolean;
  values: string[];
};

export type GameDetailBoxScore = {
  columns: string[];
  away: GameDetailBoxScorePlayer[];
  home: GameDetailBoxScorePlayer[];
};

export type GameDetailOfficial = {
  name: string;
  order: number;
};

export type GameDetail = {
  espnEventId: string;
  league: "wnba";
  status: GameStatus;
  statusLabel: string;
  venue: string | null;
  gameDate: string | null;
  broadcast: string | null;
  venueCity: string | null;
  venueState: string | null;
  officials: GameDetailOfficial[] | null;
  away: GameDetailTeam;
  home: GameDetailTeam;
  fgMade: number;
  fgAttempted: number;
  latestPlay: GameDetailLatestPlay | null;
  shots: GameDetailShot[];
  plays: GameDetailPlay[];
  winProbability: GameDetailWinProbability | null;
  matchupPrediction: GameDetailMatchupPrediction | null;
  projectedStarters: GameDetailProjectedStarters | null;
  seasonLeaders: GameDetailSeasonLeaders | null;
  injuries: GameDetailInjuries | null;
  boxScore: GameDetailBoxScore | null;
  seasonTeamStats: GameDetailSeasonTeamStats | null;
  gameLeaders: GameDetailGameLeaders | null;
};
