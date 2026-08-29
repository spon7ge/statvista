import nbaLogo from "@/assets/nba_logo.png";
import wnbaLogo from "@/assets/wnba_logo.png";
import type { LeagueSlug } from "@/shared/lib/types";

const MLB_LOGO = "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png";

export type NavGroup = "explore" | "learn";

export type NavSection = {
  label: string;
  href: string | null;
  group: NavGroup;
};

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

export function activeLeagueFromPath(pathname: string): LeagueSlug | null {
  if (pathname.startsWith("/nba")) return "nba";
  if (pathname.startsWith("/wnba") || pathname.startsWith("/games/")) {
    return "wnba";
  }
  if (pathname.startsWith("/mlb")) return "mlb";
  return null;
}

export function sectionHref(league: LeagueSlug, item: string): string | null {
  if (item === "Matchups") return `/${league}/matchups`;
  if (item === "Props" && league !== "nba") return `/${league}/prop_picks`;
  if (item === "Legs" && league !== "nba") return `/${league}/legs`;
  if (item === "Leaders" && (league === "wnba" || league === "mlb")) {
    return `/${league}/leaders`;
  }
  if (item === "Standings" && (league === "wnba" || league === "mlb")) {
    return `/${league}/standings`;
  }
  if (item === "Futures" && (league === "wnba" || league === "mlb")) {
    return `/${league}/futures`;
  }
  if (item === "MLB Chatbot") return "/mlb/chatbot";
  if (item === "WNBA Chatbot") return "/wnba/chatbot";
  return null;
}

export function isActiveSection(pathname: string, item: string): boolean {
  if (item === "Matchups") return pathname.endsWith("/matchups");
  if (item === "Props") return pathname.includes("/prop_picks");
  if (item === "Legs") return pathname.endsWith("/legs");
  if (item === "Leaders") return pathname.endsWith("/leaders");
  if (item === "Standings") return pathname.endsWith("/standings");
  if (item === "Futures") return pathname.endsWith("/futures");
  if (item === "MLB Chatbot" || item === "WNBA Chatbot") {
    return pathname.endsWith("/chatbot");
  }
  return false;
}

const DEFAULT_PROPS_HREF = "/mlb/prop_picks";
const DEFAULT_LEGS_HREF = "/mlb/legs";
const DEFAULT_MATCHUPS_HREF = "/mlb/matchups";

/** Home-row Props shortcut: current league's board, else MLB. */
export function homePropsHref(pathname: string): string {
  const league = activeLeagueFromPath(pathname);
  if (!league) return DEFAULT_PROPS_HREF;
  return sectionHref(league, "Props") ?? DEFAULT_PROPS_HREF;
}

/** Home-row Legs shortcut: current league's legs, else MLB. */
export function homeLegsHref(pathname: string): string {
  const league = activeLeagueFromPath(pathname);
  if (!league) return DEFAULT_LEGS_HREF;
  return sectionHref(league, "Legs") ?? DEFAULT_LEGS_HREF;
}

/** Home-row Matchups shortcut: current league's slate, else MLB. */
export function homeMatchupsHref(pathname: string): string {
  const league = activeLeagueFromPath(pathname);
  if (!league) return DEFAULT_MATCHUPS_HREF;
  return sectionHref(league, "Matchups") ?? DEFAULT_MATCHUPS_HREF;
}

function exploreLabels(league: LeagueSlug): readonly string[] {
  const researchTab = league === "nba" ? "Playoff race" : "Arbitrage";
  const afterProps = league === "nba" ? [] : (["EV+"] as const);
  return [
    "Matchups",
    "Props",
    ...afterProps,
    "Leaders",
    "Standings",
    researchTab,
    "Futures",
  ];
}

function learnLabels(league: LeagueSlug): readonly string[] {
  if (league === "mlb") return ["MLB Chatbot"];
  if (league === "wnba") return ["WNBA Chatbot"];
  return ["How it works", "Glossary"];
}

export function sectionsFor(league: LeagueSlug): readonly NavSection[] {
  return [
    ...exploreLabels(league).map((label) => ({
      label,
      href: sectionHref(league, label),
      group: "explore" as const,
    })),
    ...learnLabels(league).map((label) => ({
      label,
      href: sectionHref(league, label),
      group: "learn" as const,
    })),
  ];
}
