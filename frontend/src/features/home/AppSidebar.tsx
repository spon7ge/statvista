import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { StatvistaBarsMark } from "@/shared/ui/StatvistaBarsMark";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  isActiveSection,
  sectionsFor,
} from "./lib/appNav";

function rowClass(active: boolean, enabled: boolean): string {
  if (!enabled) {
    return "flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[14px] font-medium text-white/25";
  }
  if (active) {
    return "flex w-full items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline";
  }
  return "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] font-medium text-white no-underline transition-colors hover:bg-white/5";
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const [leaguesOpen, setLeaguesOpen] = useState(true);
  const activeLeague = activeLeagueFromPath(pathname);
  const homeActive = pathname === "/";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background px-3 py-4">
      <Link
        to="/"
        className="mb-4 flex items-center gap-2 px-1 text-white no-underline"
      >
        <StatvistaBarsMark />
        <span className="text-[18px] font-semibold tracking-tight">
          statvista
        </span>
      </Link>

      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="flex items-center gap-1">
          <Link
            to="/"
            aria-current={homeActive ? "page" : undefined}
            className={`flex-1 ${rowClass(homeActive, true)}`}
          >
            Home
          </Link>
          <button
            type="button"
            aria-label="Toggle leagues"
            aria-expanded={leaguesOpen}
            onClick={() => setLeaguesOpen((open) => !open)}
            className="rounded-md p-1.5 text-white transition-colors hover:bg-white/5"
          >
            {leaguesOpen ? (
              <ChevronUp className="size-3.5 opacity-70" aria-hidden strokeWidth={1.75} />
            ) : (
              <ChevronDown className="size-3.5 opacity-70" aria-hidden strokeWidth={1.75} />
            )}
          </button>
        </div>

        {leaguesOpen
          ? NAV_LEAGUES.map((league) => {
              const leagueActive = activeLeague === league.id;
              const sections = leagueActive ? sectionsFor(league.id) : [];
              const explore = sections.filter((s) => s.group === "explore");
              const learn = sections.filter((s) => s.group === "learn");
              return (
                <div key={league.id} className="mt-0.5">
                  <Link
                    to={league.href}
                    aria-current={leagueActive ? "page" : undefined}
                    className={rowClass(leagueActive, true)}
                  >
                    <img
                      src={league.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {league.label}
                  </Link>
                  {explore.length > 0 ? (
                    <div className="mt-1 ml-4">
                      <p className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
                        Explore
                      </p>
                      {explore.map((item) =>
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
                  {learn.length > 0 ? (
                    <div className="mt-2 ml-4 border-t border-white/10 pt-2">
                      <p className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
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
      </nav>

      <button
        type="button"
        aria-label="Settings"
        className="mt-3 rounded-md p-1.5 text-white transition-colors hover:bg-white/5"
      >
        <Settings className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
