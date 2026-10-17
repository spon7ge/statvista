/** ESPN CDN NBA team logos by standard tricodes. */
const ESPN_LOGO_SLUG: Record<string, string> = {
  ATL: "atl",
  BOS: "bos",
  BKN: "bkn",
  CHA: "cha",
  CHI: "chi",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GSW: "gs",
  HOU: "hou",
  IND: "ind",
  LAC: "lac",
  LAL: "lal",
  MEM: "mem",
  MIA: "mia",
  MIL: "mil",
  MIN: "min",
  NOP: "no",
  NYK: "ny",
  OKC: "okc",
  ORL: "orl",
  PHI: "phi",
  PHX: "phx",
  POR: "por",
  SAC: "sac",
  SAS: "sa",
  TOR: "tor",
  UTA: "utah",
  WAS: "wsh",
};

const LOGO_URL = "https://a.espncdn.com/i/teamlogos/nba/500/{slug}.png";

export function nbaTeamLogoUrl(abbrev: string): string | null {
  const slug = ESPN_LOGO_SLUG[abbrev.trim().toUpperCase()];
  return slug ? LOGO_URL.replace("{slug}", slug) : null;
}
