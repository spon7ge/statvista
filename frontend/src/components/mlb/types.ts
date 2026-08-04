export type MlbGameStatus = "scheduled" | "live" | "halftime" | "final";

export type MlbGameDetailTeam = {
  id: string;
  abbrev: string;
  name: string;
  score: number | null;
  record: string | null;
  color: string;
  logoUrl: string | null;
};

export type MlbTeamStatLine = {
  avg: string | null;
  obp: string | null;
  slg: string | null;
  hr: number | null;
  r: number | null;
  h: number | null;
  k: number | null;
  sb: number | null;
  lob: number | null;
  era: string | null;
};

export type MlbDecisions = {
  winner: string | null;
  loser: string | null;
  save: string | null;
};

export type MlbLinescoreInning = {
  num: number;
  awayRuns: number | null;
  homeRuns: number | null;
};

export type MlbLinescoreTotals = {
  runs: number;
  hits: number;
  errors: number;
};

export type MlbLinescore = {
  currentInning: number | null;
  inningHalf: "top" | "bottom" | null;
  innings: MlbLinescoreInning[];
  away: MlbLinescoreTotals;
  home: MlbLinescoreTotals;
};

export type MlbPlayerCard = {
  name: string;
  hand: string | null;
  summary: string | null;
};

export type MlbPitch = {
  number: number;
  type: string | null;
  mph: number | null;
  result: string | null;
  isStrike: boolean;
  zoneX: number | null;
  zoneY: number | null;
};

export type MlbSituation = {
  balls: number;
  strikes: number;
  outs: number;
  runners: { first: boolean; second: boolean; third: boolean };
  pitches: MlbPitch[];
  atBat: MlbPlayerCard | null;
  onDeck: MlbPlayerCard | null;
  pitching: MlbPlayerCard | null;
  latestPlayText: string | null;
};

export type MlbPlay = {
  id: string;
  inning: number;
  half: "top" | "bottom";
  text: string;
  event: string | null;
  scoring: boolean;
  awayScore: number;
  homeScore: number;
  exitVelo: number | null;
  launchAngle: number | null;
  totalDistance: number | null;
  scoringTeam: "away" | "home" | null;
};

export type MlbBatterRow = {
  name: string;
  position: string | null;
  order: number | null;
  ab: number | null;
  r: number | null;
  h: number | null;
  rbi: number | null;
  bb: number | null;
  so: number | null;
  hr: number | null;
  sb: number | null;
};

export type MlbPitcherRow = {
  name: string;
  ip: string | null;
  h: number | null;
  r: number | null;
  er: number | null;
  bb: number | null;
  k: number | null;
  pitches: number | null;
};

export type MlbBoxScore = {
  awayBatters: MlbBatterRow[];
  homeBatters: MlbBatterRow[];
  awayPitchers: MlbPitcherRow[];
  homePitchers: MlbPitcherRow[];
};

export type MlbWinProbabilityPoint = {
  playId: string;
  label: string;
  homeWinPct: number;
};

export type MlbWinProbability = {
  awayAbbrev: string;
  homeAbbrev: string;
  points: MlbWinProbabilityPoint[];
  stakes: { label: string; homeWinDelta: number } | null;
};

export type MlbHitPoint = {
  id: string;
  team: "away" | "home";
  playerName: string | null;
  result: "hr" | "hit" | "out";
  x: number;
  y: number;
};

export type MlbGameDetailView = {
  mlbGamePk: string;
  league: "mlb";
  status: MlbGameStatus;
  statusLabel: string;
  gameDateLabel: string | null;
  venue: string | null;
  away: MlbGameDetailTeam;
  home: MlbGameDetailTeam;
  decisions: MlbDecisions | null;
  linescore: MlbLinescore | null;
  situation: MlbSituation | null;
  plays: MlbPlay[];
  scoringPlays: MlbPlay[];
  boxScore: MlbBoxScore | null;
  teamStats: { away: MlbTeamStatLine; home: MlbTeamStatLine } | null;
  winProbability: MlbWinProbability | null;
  hitChart: MlbHitPoint[];
  sources: string[];
  fetchedAt: string;
};
