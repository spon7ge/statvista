import type { components } from "./api.schema";

type Schemas = components["schemas"];

export type ApiGameStatus = Schemas["WnbaGame"]["status"];
export type ApiWnbaTeam = Schemas["WnbaTeam"];
export type ApiWnbaGame = Schemas["WnbaGame"];
export type ApiGameDetailTeam = Schemas["GameDetailTeam"];
export type ApiGameDetailShot = Schemas["GameDetailShot"];
export type ApiGameDetailPlay = Schemas["GameDetailPlay"];
export type ApiGameDetailLatestPlay = Schemas["GameDetailLatestPlay"];
export type ApiGameDetailWinProbabilityPoint =
  Schemas["GameDetailWinProbabilityPoint"];
export type ApiGameDetailTeamStat = Schemas["GameDetailTeamStat"];
export type ApiGameDetailWinProbability = Schemas["GameDetailWinProbability"];
export type ApiGameDetailMatchupPrediction =
  Schemas["GameDetailMatchupPrediction"];
export type ApiGameDetailStarter = Schemas["GameDetailStarter"];
export type ApiGameDetailProjectedStarters =
  Schemas["GameDetailProjectedStarters"];
export type ApiGameDetailSeasonLeader = Schemas["GameDetailSeasonLeader"];
export type ApiGameDetailSeasonLeaders = Schemas["GameDetailSeasonLeaders"];
export type ApiGameDetailInjury = Schemas["GameDetailInjury"];
export type ApiGameDetailInjuries = Schemas["GameDetailInjuries"];
export type ApiGameDetailBoxScorePlayer = Schemas["GameDetailBoxScorePlayer"];
export type ApiGameDetailBoxScore = Schemas["GameDetailBoxScore"];
export type ApiWnbaGameDetail = Schemas["WnbaGameDetail"];
export type WnbaScoreboardResponse = Schemas["WnbaScoreboardResponse"];

export type ApiWnbaLeaderRow = Schemas["WnbaLeaderRow"];
export type ApiWnbaLeaderCategory = Schemas["WnbaLeaderCategory"];
export type ApiWnbaLeadersResponse = Schemas["WnbaLeadersResponse"];

export type ApiWnbaStandingsRow = Schemas["WnbaStandingsRow"];
export type ApiWnbaStandingsConference = Schemas["WnbaStandingsConference"];
export type ApiWnbaStandingsResponse = Schemas["WnbaStandingsResponse"];

export type ApiWnbaOddsGame = Schemas["WnbaOddsGame"];
export type ApiWnbaOddsResponse = Schemas["WnbaOddsResponse"];

export type ApiWnbaPropBookQuote = Schemas["WnbaPropBookQuote"];
export type ApiWnbaPropLine = Schemas["WnbaPropLine"];
export type ApiWnbaPropsResponse = Schemas["WnbaPropsResponse"];
export type ApiWnbaGamePropsResponse = Schemas["WnbaGamePropsResponse"];

export type ApiWnbaFuturesEntry = Schemas["WnbaFuturesEntry"];
export type ApiWnbaFuturesMarket = Schemas["WnbaFuturesMarket"];
export type ApiWnbaFuturesResponse = Schemas["WnbaFuturesResponse"];

export type ApiWnbaPlayerAverages = Schemas["WnbaPlayerAverages"];
export type ApiWnbaPlayerGame = Schemas["WnbaPlayerGame"];
export type ApiWnbaPlayerResponse = Schemas["WnbaPlayerResponse"];
export type ApiWnbaTeamPreviewResponse = Schemas["WnbaTeamPreviewResponse"];

export type WnbaTeamPreviewParams = {
  espnEventId: string;
  side: "away" | "home";
};

export type WnbaGamePropsParams = {
  espnEventId: string;
  app: "prizepicks" | "underdog";
};

export type ApiMlbTeam = Schemas["MlbTeam"];
export type ApiMlbGame = Schemas["MlbGame"];
export type MlbScoreboardResponse = Schemas["MlbScoreboardResponse"];
export type ApiMlbOddsGame = Schemas["MlbOddsGame"];
export type ApiMlbOddsResponse = Schemas["MlbOddsResponse"];
export type ApiMlbGameDetail = Schemas["MlbGameDetail"];
export type ApiMlbLineupsResponse = Schemas["MlbLineupsResponse"];
export type ApiMlbLineupGame = Schemas["MlbLineupGame"];
export type ApiMlbLineupSide = Schemas["MlbLineupSide"];
export type ApiMlbLineupBatter = Schemas["MlbLineupBatter"];
export type ApiMlbLineupPitcher = Schemas["MlbLineupPitcher"];
export type ApiMlbLineupMatchupResponse = Schemas["MlbLineupMatchupResponse"];
export type ApiMlbPropBookQuote = Schemas["MlbPropBookQuote"];
export type ApiMlbPropBooks = Schemas["MlbPropBooks"];
export type ApiMlbPropDfs = Schemas["MlbPropDfs"];
export type ApiMlbPropRow = Schemas["MlbPropRow"];
export type ApiMlbPropsResponse = Schemas["MlbPropsResponse"];
export type ApiMlbGamePropsResponse = Schemas["MlbGamePropsResponse"];
export type ApiMlbTeamPreviewResponse = Schemas["MlbTeamPreviewResponse"];
export type ApiMlbLeaderRow = Schemas["MlbLeaderRow"];
export type ApiMlbLeaderCategory = Schemas["MlbLeaderCategory"];
export type ApiMlbLeadersResponse = Schemas["MlbLeadersResponse"];
export type ApiMlbStandingsRow = Schemas["MlbStandingsRow"];
export type ApiMlbStandingsDivision = Schemas["MlbStandingsDivision"];
export type ApiMlbStandingsLeague = Schemas["MlbStandingsLeague"];
export type ApiMlbStandingsResponse = Schemas["MlbStandingsResponse"];
export type ApiMlbFuturesEntry = Schemas["MlbFuturesEntry"];
export type ApiMlbFuturesMarket = Schemas["MlbFuturesMarket"];
export type ApiMlbFuturesResponse = Schemas["MlbFuturesResponse"];

export type MlbPropsParams = {
  app: string;
  format: string;
  legs: number;
};

export type MlbGamePropsParams = {
  gamePk: string;
  app: "prizepicks" | "underdog";
};

export type MlbTeamPreviewParams = {
  gamePk: string;
  side: "away" | "home";
};

/** Shared shape for matchup odds merge (WNBA + MLB). */
export type ApiMatchupOddsGame = ApiWnbaOddsGame | ApiMlbOddsGame;

/**
 * Origin of the statvista API, without a trailing slash.
 *
 * Empty in local dev, where Vite's `/api` proxy forwards to the backend. Static
 * hosts (GitHub Pages and friends) have no proxy, so their builds must set
 * `VITE_API_BASE_URL` to the live API origin or every request 404s.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export async function fetchWnbaScoreboard(): Promise<WnbaScoreboardResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/scoreboard/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Scoreboard request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaScoreboardByDate(
  dateEt: string,
): Promise<WnbaScoreboardResponse> {
  const res = await fetch(
    `${API_BASE}/api/wnba/scoreboard?date=${encodeURIComponent(dateEt)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Scoreboard request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchGameDetail(
  espnEventId: string,
): Promise<ApiWnbaGameDetail> {
  const res = await fetch(`${API_BASE}/api/wnba/games/${espnEventId}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Game detail request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaLeaders(): Promise<ApiWnbaLeadersResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/leaders`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Leaders request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaStandings(): Promise<ApiWnbaStandingsResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/standings`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Standings request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaOdds(): Promise<ApiWnbaOddsResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/odds/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Odds request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaProps(): Promise<ApiWnbaPropsResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/props/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Props request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaGameProps({
  espnEventId,
  app,
}: WnbaGamePropsParams): Promise<ApiWnbaGamePropsResponse> {
  const qs = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/api/wnba/props/game/${encodeURIComponent(espnEventId)}?${qs}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`WNBA game props request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaFutures(): Promise<ApiWnbaFuturesResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/futures`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Futures request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaPlayer(
  playerId: string,
): Promise<ApiWnbaPlayerResponse> {
  const res = await fetch(`${API_BASE}/api/wnba/player/${playerId}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Player request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchWnbaTeamPreview({
  espnEventId,
  side,
}: WnbaTeamPreviewParams): Promise<ApiWnbaTeamPreviewResponse> {
  const qs = new URLSearchParams({ side });
  const res = await fetch(
    `${API_BASE}/api/wnba/games/${encodeURIComponent(espnEventId)}/team-preview?${qs}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`WNBA team preview request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbScoreboard(): Promise<MlbScoreboardResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/scoreboard/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB scoreboard request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbScoreboardByDate(
  dateEt: string,
): Promise<MlbScoreboardResponse> {
  const res = await fetch(
    `${API_BASE}/api/mlb/scoreboard?date=${encodeURIComponent(dateEt)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`MLB scoreboard request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbLeaders(): Promise<ApiMlbLeadersResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/leaders`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB leaders failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbStandings(): Promise<ApiMlbStandingsResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/standings`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB standings failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbFutures(): Promise<ApiMlbFuturesResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/futures`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB futures failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbOdds(): Promise<ApiMlbOddsResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/odds/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB odds request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbProps({
  app,
  format,
  legs,
}: MlbPropsParams): Promise<ApiMlbPropsResponse> {
  const qs = new URLSearchParams({
    app,
    format,
    legs: String(legs),
  });
  const res = await fetch(`${API_BASE}/api/mlb/props/today?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB props request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbGameProps({
  gamePk,
  app,
}: MlbGamePropsParams): Promise<ApiMlbGamePropsResponse> {
  const qs = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/api/mlb/props/game/${encodeURIComponent(gamePk)}?${qs}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`MLB game props request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbTeamPreview({
  gamePk,
  side,
}: MlbTeamPreviewParams): Promise<ApiMlbTeamPreviewResponse> {
  const qs = new URLSearchParams({ side });
  const res = await fetch(
    `${API_BASE}/api/mlb/games/${encodeURIComponent(gamePk)}/team-preview?${qs}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`MLB team preview request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbGameDetail(
  gamePk: string,
): Promise<ApiMlbGameDetail> {
  const res = await fetch(`${API_BASE}/api/mlb/games/${gamePk}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB game detail request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbLineups(
  dateEt: string,
): Promise<ApiMlbLineupsResponse> {
  const res = await fetch(
    `${API_BASE}/api/mlb/lineups?date=${encodeURIComponent(dateEt)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`MLB lineups request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMlbLineupMatchup(
  dateEt: string,
  away: string,
  home: string,
): Promise<ApiMlbLineupMatchupResponse> {
  const qs = new URLSearchParams({
    date: dateEt,
    away,
    home,
  });
  const res = await fetch(`${API_BASE}/api/mlb/lineups/matchup?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB lineup matchup request failed: ${res.status}`);
  }
  return res.json();
}
