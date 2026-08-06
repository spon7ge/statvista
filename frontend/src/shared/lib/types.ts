/** Cross-league slate / scoreboard vocabulary used by home, league UI, and hooks. */

export type HomeLeague = "nba" | "wnba" | "mlb";

export type LeagueSlug = HomeLeague;

export type GameStatus = "scheduled" | "live" | "halftime" | "final";

export type TickerGame = {
  id: string;
  espnEventId?: string | null;
  mlbGamePk?: string | null;
  league: HomeLeague;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogoUrl: string | null;
  homeLogoUrl: string | null;
  statusLabel: string;
  status: GameStatus;
  awayScore: number | null;
  homeScore: number | null;
};

export type LiveGameTeam = {
  abbrev: string;
  name: string;
  score: number | null;
  logoUrl: string | null;
};

export type LiveGame = {
  id: string;
  espnEventId?: string | null;
  mlbGamePk?: string | null;
  league: HomeLeague;
  statusLabel: string;
  status: GameStatus;
  away: LiveGameTeam;
  home: LiveGameTeam;
};

export type MatchupTeam = {
  abbrev: string;
  name: string;
  score: number | null;
  record?: string | null;
  logoUrl: string | null;
};

export type MatchupOdds = {
  spreadTeamAbbrev: string | null;
  spreadLine: number | null;
  total: number | null;
  sportsbook?: string | null;
};

export type MatchupGame = {
  id: string;
  espnEventId?: string | null;
  mlbGamePk?: string | null;
  league: HomeLeague;
  status: GameStatus;
  statusLabel: string;
  venue?: string | null;
  venueCity?: string | null;
  away: MatchupTeam;
  home: MatchupTeam;
  odds?: MatchupOdds | null;
};
