import nbaLogo from "@/assets/nba_logo.png";
import wnbaLogo from "@/assets/wnba_logo.png";
import type { LeagueSlug } from "@/shared/lib/types";

const MLB_LOGO = "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png";

/** First screen after joining: MLB matchups (NBA/WNBA via league pills). */
export const LANDING_HREF = "/mlb/matchups";

export type NavLeague = {
  id: LeagueSlug;
  label: string;
  icon: string;
  href: string;
};

export const NAV_LEAGUES: readonly NavLeague[] = [
  { id: "nba", label: "NBA", icon: nbaLogo, href: "/nba/matchups" },
  { id: "wnba", label: "WNBA", icon: wnbaLogo, href: "/wnba/matchups" },
  { id: "mlb", label: "MLB", icon: MLB_LOGO, href: "/mlb/matchups" },
];

/** MLB first, then the other leagues we support (pills + Home submenu). */
export const LEAGUE_PILL_ORDER: readonly LeagueSlug[] = ["mlb", "wnba", "nba"];

export function orderedNavLeagues(): NavLeague[] {
  return LEAGUE_PILL_ORDER.flatMap((id) => {
    const league = NAV_LEAGUES.find((item) => item.id === id);
    return league ? [league] : [];
  });
}

export function activeLeagueFromPath(pathname: string): LeagueSlug | null {
  if (pathname.startsWith("/nba")) return "nba";
  if (pathname.startsWith("/wnba") || pathname.startsWith("/games/")) {
    return "wnba";
  }
  if (pathname.startsWith("/mlb")) return "mlb";
  return null;
}

export function sectionHref(league: LeagueSlug, item: string): string | null {
  if (item === "Games") return `/${league}/matchups`;
  if (item === "Props") return `/${league}/prop_picks`;
  return null;
}

export function isActiveSection(pathname: string, item: string): boolean {
  if (item === "Games") return pathname.endsWith("/matchups");
  if (item === "Props") return pathname.includes("/prop_picks");
  return false;
}

const DEFAULT_PROPS_HREF = "/mlb/prop_picks";
const DEFAULT_MATCHUPS_HREF = LANDING_HREF;

/** Sidebar Props shortcut: current league's board, else MLB. */
export function homePropsHref(pathname: string): string {
  const league = activeLeagueFromPath(pathname);
  if (!league) return DEFAULT_PROPS_HREF;
  return sectionHref(league, "Props") ?? DEFAULT_PROPS_HREF;
}

/** Sidebar Games shortcut: current league's slate, else MLB. */
export function homeMatchupsHref(pathname: string): string {
  const league = activeLeagueFromPath(pathname);
  if (!league) return DEFAULT_MATCHUPS_HREF;
  return sectionHref(league, "Games") ?? DEFAULT_MATCHUPS_HREF;
}
