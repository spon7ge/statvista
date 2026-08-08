import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import nbaLogo from "@/assets/nba_logo.png";
import wnbaLogo from "@/assets/wnba_logo.png";
import { StatvistaBarsMark } from "@/shared/ui/StatvistaBarsMark";

const MLB_LOGO =
  "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png";

const leagues = [
  { id: "nba", label: "NBA", icon: nbaLogo },
  { id: "wnba", label: "WNBA", icon: wnbaLogo },
  { id: "mlb", label: "MLB", icon: MLB_LOGO },
] as const;

export function HomeNav() {
  const { pathname } = useLocation();
  const aboutActive = pathname === "/about";
  const activeLeague =
    leagues.find((league) => pathname.startsWith(`/${league.id}`)) ?? null;

  const [leagueOpen, setLeagueOpen] = useState(false);
  const leagueMenuId = useId();
  const leagueRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leagueOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!leagueRootRef.current?.contains(event.target as Node)) {
        setLeagueOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLeagueOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [leagueOpen]);

  return (
    <header className="border-b border-white/10 bg-background">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-white no-underline">
          <StatvistaBarsMark />
          <span className="text-[18px] font-semibold tracking-tight text-white">
            statvista
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3" aria-label="Primary">
            <div className="hidden items-center gap-1 sm:flex">
              {leagues.map((league) => {
                const active = pathname.startsWith(`/${league.id}`);
                return (
                  <Link
                    key={league.id}
                    to={`/${league.id}/matchups`}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-[14px] font-medium text-white no-underline"
                        : "flex items-center gap-2 rounded-md px-3 py-1 text-[14px] font-medium text-white no-underline transition-colors hover:bg-white/5"
                    }
                  >
                    <img
                      src={league.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {league.label}
                  </Link>
                );
              })}
            </div>

            <div ref={leagueRootRef} className="relative sm:hidden">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={leagueOpen}
                aria-controls={leagueMenuId}
                onClick={() => setLeagueOpen((open) => !open)}
                className={
                  activeLeague || aboutActive
                    ? "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[14px] font-medium text-white"
                    : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[14px] font-medium text-white transition-colors hover:bg-white/5"
                }
              >
                {activeLeague ? (
                  <>
                    <img
                      src={activeLeague.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {activeLeague.label}
                  </>
                ) : aboutActive ? (
                  "About"
                ) : (
                  "Leagues"
                )}
                <ChevronDown
                  className="size-3.5 opacity-70"
                  aria-hidden
                  strokeWidth={1.75}
                />
              </button>
              {leagueOpen ? (
                <ul
                  id={leagueMenuId}
                  role="menu"
                  aria-label="Leagues"
                  className="absolute top-full right-0 z-20 mt-1.5 min-w-[9rem] rounded-lg border border-white/10 bg-black py-0.5"
                >
                  {leagues.map((league) => {
                    const active = pathname.startsWith(`/${league.id}`);
                    return (
                      <li key={league.id} role="none">
                        <Link
                          role="menuitem"
                          to={`/${league.id}/matchups`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setLeagueOpen(false)}
                          className={
                            active
                              ? "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline bg-white/10"
                              : "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline hover:bg-white/5"
                          }
                        >
                          <img
                            src={league.icon}
                            alt=""
                            aria-hidden
                            className="size-5 shrink-0 object-contain"
                          />
                          {league.label}
                        </Link>
                      </li>
                    );
                  })}
                  <li role="none" className="mt-0.5 border-t border-white/10">
                    <Link
                      role="menuitem"
                      to="/about"
                      aria-current={aboutActive ? "page" : undefined}
                      onClick={() => setLeagueOpen(false)}
                      className={
                        aboutActive
                          ? "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline bg-white/10"
                          : "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline hover:bg-white/5"
                      }
                    >
                      About
                    </Link>
                  </li>
                </ul>
              ) : null}
            </div>

            <Link
              to="/about"
              aria-current={aboutActive ? "page" : undefined}
              className={
                aboutActive
                  ? "hidden rounded-md bg-white/10 px-2.5 py-1 text-[14px] font-medium text-white no-underline sm:inline"
                  : "hidden rounded-md px-2.5 py-1 text-[14px] font-medium text-white no-underline transition-colors hover:bg-white/5 sm:inline"
              }
            >
              About
            </Link>
          </nav>

          <button
            type="button"
            aria-label="Settings"
            className="rounded-md p-1.5 text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
