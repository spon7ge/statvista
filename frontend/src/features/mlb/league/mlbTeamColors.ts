/** Official MLB primary brand colors by Stats API abbreviation. */
const MLB_TEAM_COLORS: Record<string, string> = {
  ARI: "#A71930",
  AZ: "#A71930",
  ATL: "#CE1141",
  BAL: "#DF4601",
  BOS: "#BD3039",
  CHC: "#0E3386",
  CWS: "#27251F",
  CIN: "#C6011F",
  CLE: "#00385D",
  COL: "#333366",
  DET: "#0C2340",
  HOU: "#002D62",
  KC: "#004687",
  LAA: "#BA0021",
  LAD: "#005A9C",
  MIA: "#00A3E0",
  MIL: "#12284B",
  MIN: "#002B5C",
  NYM: "#002D72",
  NYY: "#0C2340",
  ATH: "#003831",
  OAK: "#003831",
  PHI: "#E81828",
  PIT: "#FDB827",
  SD: "#2F241D",
  SF: "#FD5A1E",
  SEA: "#0C2C56",
  STL: "#C41E3A",
  TB: "#092C5C",
  TEX: "#003278",
  TOR: "#134A8E",
  WSH: "#AB0003",
  WAS: "#AB0003",
};

const FALLBACK = "rgba(255,255,255,0.5)";

export function teamColor(abbrev: string): string {
  const key = abbrev.trim().toUpperCase();
  return MLB_TEAM_COLORS[key] ?? FALLBACK;
}

/** Prefer the official primary when known; otherwise keep the API/fallback color. */
export function resolveMlbTeamColor(abbrev: string, fallback: string): string {
  const key = abbrev.trim().toUpperCase();
  return MLB_TEAM_COLORS[key] ?? fallback;
}
