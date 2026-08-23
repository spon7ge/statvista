/** ESPN CDN WNBA team logos by Stats / ESPN tricodes. */

const ESPN_LOGO_SLUG: Record<string, string> = {
  ATL: "atl",
  CHI: "chi",
  CON: "con",
  CONN: "con",
  DAL: "dal",
  GS: "gs",
  GSV: "gs",
  IND: "ind",
  LA: "la",
  LAS: "la",
  LV: "lv",
  LVA: "lv",
  MIN: "min",
  NY: "ny",
  NYL: "ny",
  PHO: "phx",
  PHX: "phx",
  POR: "por",
  SEA: "sea",
  TOR: "tor",
  WAS: "wsh",
  WSH: "wsh",
};

const LOGO_URL = "https://a.espncdn.com/i/teamlogos/wnba/500/{slug}.png";

export function wnbaTeamLogoUrl(abbrev: string): string | null {
  const key = abbrev.trim().toUpperCase();
  const slug = ESPN_LOGO_SLUG[key];
  if (!slug) return null;
  return LOGO_URL.replace("{slug}", slug);
}
