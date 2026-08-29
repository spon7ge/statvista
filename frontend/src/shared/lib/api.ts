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

export type ApiWnbaOddsGame = Schemas["WnbaOddsGame"];
export type ApiWnbaOddsResponse = Schemas["WnbaOddsResponse"];

export type ApiWnbaPropBookQuote = Schemas["WnbaPropBookQuote"];
export type ApiWnbaPropBookMainQuote = Schemas["WnbaPropBookMainQuote"];
export type ApiWnbaPropDfs = Schemas["WnbaPropDfs"];
export type ApiWnbaPropRow = Schemas["WnbaPropRow"];
export type ApiWnbaPropPicksResponse = Schemas["WnbaPropPicksResponse"];
export type ApiWnbaGamePropsResponse = Schemas["WnbaGamePropsResponse"];

export type WnbaPropsParams = {
  app: string;
  format: string;
  legs: number;
};

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
export type ApiMlbPropBookMainQuote = Schemas["MlbPropBookMainQuote"];
export type ApiMlbPropBooksMain = Schemas["MlbPropBooksMain"];
export type ApiMlbPropDfs = Schemas["MlbPropDfs"];
export type ApiMlbPropRow = Schemas["MlbPropRow"];
export type ApiMlbPropsResponse = Schemas["MlbPropsResponse"];
export type ApiMlbPropBoardBookChip = Schemas["MlbPropBoardBookChip"];
export type ApiMlbPropBoardRow = Schemas["MlbPropBoardRow"];
export type ApiMlbPropBoardResponse = Schemas["MlbPropBoardResponse"];
export type ApiMlbGamePropsResponse = Schemas["MlbGamePropsResponse"];
export type ApiMlbTeamPreviewResponse = Schemas["MlbTeamPreviewResponse"];

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

export async function fetchWnbaProps({
  app,
  format,
  legs,
}: WnbaPropsParams): Promise<ApiWnbaPropPicksResponse> {
  const qs = new URLSearchParams({
    app,
    format,
    legs: String(legs),
  });
  const res = await fetch(`${API_BASE}/api/wnba/props/today?${qs}`, {
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

export async function fetchMlbPropBoard(): Promise<ApiMlbPropBoardResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/props/board`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB prop board request failed: ${res.status}`);
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
