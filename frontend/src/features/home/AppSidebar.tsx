import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Calendar,
  Info,
  Layers,
  LayoutList,
  Newspaper,
  Settings,
} from "lucide-react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { StatvistaWordmark } from "@/shared/ui/StatvistaWordmark";
import {
  LANDING_HREF,
  homeArbitrageHref,
  homeLegsHref,
  homeMatchupsHref,
  homePropsHref,
  isActiveSection,
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
  const propsHref = homePropsHref(pathname);
  const propsActive = isActiveSection(pathname, "Props");
  const legsHref = homeLegsHref(pathname);
  const legsActive = isActiveSection(pathname, "Legs");
  const arbitrageHref = homeArbitrageHref(pathname);
  const arbitrageActive = isActiveSection(pathname, "Arbitrage");
  const matchupsHref = homeMatchupsHref(pathname);
  const matchupsActive = isActiveSection(pathname, "Games");
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchPropsBoard(queryClient, propsHref);
  }, [queryClient, propsHref]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col bg-background px-3 pb-4 ${CHROME_TITLE_TOP}`}
    >
      <Link
        to={LANDING_HREF}
        className="mb-4 flex min-h-8 items-center text-white no-underline"
      >
        <StatvistaWordmark />
      </Link>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
      <nav aria-label="Primary">
        <div className={`${SIDEBAR_PANEL} space-y-[9px]`}>
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
            to={arbitrageHref}
            aria-current={arbitrageActive ? "page" : undefined}
            className={rowClass(arbitrageActive, true)}
          >
            <ArrowLeftRight
              className="size-[22px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Arbitrage
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
            Games
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
