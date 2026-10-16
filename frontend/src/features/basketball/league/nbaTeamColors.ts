/** Official NBA primary brand colors by common tricodes. */
const NBA_TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E",
  BKN: "#000000",
  BOS: "#007A33",
  CHA: "#1D1160",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#0E2240",
  DET: "#C8102E",
  GS: "#1D428A",
  GSW: "#1D428A",
  HOU: "#CE1141",
  IND: "#002D62",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#0C2340",
  NO: "#0C2340",
  NOP: "#0C2340",
  NY: "#006BB6",
  NYK: "#006BB6",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHO: "#1D1160",
  PHX: "#1D1160",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SA: "#C4CED4",
  SAS: "#C4CED4",
  TOR: "#CE1141",
  UTA: "#002B5C",
  WAS: "#002B5C",
  WSH: "#002B5C",
};

/** Prefer the official primary when known; otherwise keep the API color. */
export function resolveNbaTeamColor(abbrev: string, fallback: string): string {
  const key = abbrev.trim().toUpperCase();
  return NBA_TEAM_COLORS[key] ?? fallback;
}
