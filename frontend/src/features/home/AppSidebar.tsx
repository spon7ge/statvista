import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  Home,
  Info,
  Layers,
  LayoutList,
  Newspaper,
  Settings,
} from "lucide-react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { StatvistaWordmark } from "@/shared/ui/StatvistaWordmark";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  homeLegsHref,
  homeMatchupsHref,
  homePropsHref,
  isActiveSection,
  sectionsFor,
} from "./lib/appNav";
import { prefetchPropsBoard } from "./lib/prefetchPropsBoard";

/** Matches Statmuse card: rounded-2xl, px-3.25 (13px), py-2.25 (9px). */
const SIDEBAR_PANEL =
  "overflow-hidden rounded-2xl bg-[#1e1e1e] px-[13px] py-[9px]";

function rowClass(active: boolean, enabled: boolean): string {
  const base =
    "flex w-full items-center gap-[13px] text-base font-semibold no-underline";
  if (!enabled) {
    return `${base} cursor-not-allowed text-left text-white/25`;
  }
  if (active) {
    return `${base} text-white`;
  }
  return `${base} text-white transition-colors hover:text-white/70`;
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const [leaguesOpen, setLeaguesOpen] = useState(true);
  const activeLeague = activeLeagueFromPath(pathname);
  const homeActive = pathname === "/";
  const propsHref = homePropsHref(pathname);
  const propsActive = isActiveSection(pathname, "Props");
  const legsHref = homeLegsHref(pathname);
  const legsActive = isActiveSection(pathname, "Legs");
  const matchupsHref = homeMatchupsHref(pathname);
  const matchupsActive = isActiveSection(pathname, "Matchups");
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchPropsBoard(queryClient, propsHref);
  }, [queryClient, propsHref]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col bg-background px-3 pb-4 ${CHROME_TITLE_TOP}`}
    >
      <Link
        to="/"
        className="mb-4 flex min-h-7 items-center text-white no-underline"
      >
        <StatvistaWordmark />
      </Link>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      <nav aria-label="Primary">
        <div className={`${SIDEBAR_PANEL} space-y-[9px]`}>
          <div className="flex items-center">
            <Link
              to="/"
              aria-current={homeActive ? "page" : undefined}
              className={`flex-1 ${rowClass(homeActive, true)}`}
            >
              <Home
                className="size-[22px] shrink-0"
                strokeWidth={2}
                aria-hidden
              />
              <span className="flex-1">Home</span>
            </Link>
            <button
              type="button"
              aria-label="Toggle leagues"
              aria-expanded={leaguesOpen}
              onClick={() => setLeaguesOpen((open) => !open)}
              className="flex w-[31px] shrink-0 cursor-pointer justify-end text-white"
            >
              <ChevronDown
                className={`size-[18px] transition-transform ${leaguesOpen ? "rotate-180" : ""}`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          </div>

          {leaguesOpen
            ? NAV_LEAGUES.map((league) => {
                const leagueActive = activeLeague === league.id;
                const sections = leagueActive ? sectionsFor(league.id) : [];
                const explore = sections.filter((s) => s.group === "explore");
                const learn = sections.filter((s) => s.group === "learn");
                return (
                  <div key={league.id} className="pl-[13px]">
                    <Link
                      to={league.href}
                      aria-current={leagueActive ? "page" : undefined}
                      className={rowClass(leagueActive, true)}
                    >
                      <img
                        src={league.icon}
                        alt=""
                        aria-hidden
                        className="size-[22px] shrink-0 object-contain"
                      />
                      {league.label}
                    </Link>
                    {explore.length > 0 ? (
                      <div className="mt-[9px] space-y-[9px] pl-[13px]">
                        <p className="text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
                          Explore
                        </p>
                        {explore.map((item) => {
                          const href = item.href;
                          if (!href) {
                            return (
                              <button
                                key={item.label}
                                type="button"
                                disabled
                                className={rowClass(false, false)}
                              >
                                {item.label}
                              </button>
                            );
                          }
                          return (
                            <Link
                              key={item.label}
                              to={href}
                              aria-current={
                                isActiveSection(pathname, item.label)
                                  ? "page"
                                  : undefined
                              }
                              className={rowClass(
                                isActiveSection(pathname, item.label),
                                true,
                              )}
                              onPointerEnter={
                                item.label === "Props"
                                  ? () =>
                                      prefetchPropsBoard(queryClient, href)
                                  : undefined
                              }
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                    {learn.length > 0 ? (
                      <div className="mt-[9px] space-y-[9px] border-t border-white/10 pt-[9px] pl-[13px]">
                        <p className="text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
                          Learn
                        </p>
                        {learn.map((item) =>
                          item.href ? (
                            <Link
                              key={item.label}
                              to={item.href}
                              aria-current={
                                isActiveSection(pathname, item.label)
                                  ? "page"
                                  : undefined
                              }
                              className={rowClass(
                                isActiveSection(pathname, item.label),
                                true,
                              )}
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <button
                              key={item.label}
                              type="button"
                              disabled
                              className={rowClass(false, false)}
                            >
                              {item.label}
                            </button>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            : null}

          <Link
            to={propsHref}
            aria-current={propsActive ? "page" : undefined}
            className={rowClass(propsActive, true)}
            onPointerEnter={() => prefetchPropsBoard(queryClient, propsHref)}
          >
            <LayoutList
              className="size-[22px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Props
          </Link>
          <Link
            to={legsHref}
            aria-current={legsActive ? "page" : undefined}
            className={rowClass(legsActive, true)}
          >
            <Layers
              className="size-[22px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Legs
          </Link>
          <Link
            to={matchupsHref}
            aria-current={matchupsActive ? "page" : undefined}
            className={rowClass(matchupsActive, true)}
          >
            <Calendar
              className="size-[22px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Matchups
          </Link>
        </div>
      </nav>

      <nav
        aria-label="Site"
        className={`space-y-[9px] ${SIDEBAR_PANEL}`}
      >
        <button type="button" className={rowClass(false, true)}>
          <Info className="size-[22px] shrink-0" strokeWidth={2} aria-hidden />
          About
        </button>
        <button type="button" className={rowClass(false, true)}>
          <Newspaper
            className="size-[22px] shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          Blog
        </button>
        <button type="button" className={rowClass(false, true)}>
          <Settings
            className="size-[22px] shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          Settings
        </button>
      </nav>
      </div>
    </div>
  );
}
