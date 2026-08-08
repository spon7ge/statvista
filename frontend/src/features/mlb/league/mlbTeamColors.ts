/** Brand colors for MLB Stats API team abbreviations on dark UI. */
const MLB_TEAM_COLORS: Record<string, string> = {
  ARI: "#A71930",
  ATL: "#CE1141",
  BAL: "#DF4601",
  BOS: "#BD3039",
  CHC: "#0E3386",
  CWS: "#27251F",
  CIN: "#C6011F",
  CLE: "#E31937",
  COL: "#333366",
  DET: "#0C2C56",
  HOU: "#EB6E1F",
  KC: "#004687",
  LAA: "#BA0021",
  LAD: "#005A9C",
  MIA: "#00A3E0",
  MIL: "#FFC52F",
  MIN: "#002B5C",
  NYM: "#FF5910",
  NYY: "#003087",
  OAK: "#003831",
  PHI: "#E81828",
  PIT: "#FDB827",
  SD: "#2F241D",
  SF: "#FD5A1E",
  SEA: "#0C2C56",
  STL: "#C41E3A",
  TB: "#8FBCE6",
  TEX: "#003278",
  TOR: "#134A8E",
  WSH: "#AB0003",
};

const FALLBACK = "rgba(255,255,255,0.5)";

export function teamColor(abbrev: string): string {
  const key = abbrev.trim().toUpperCase();
  return MLB_TEAM_COLORS[key] ?? FALLBACK;
}
