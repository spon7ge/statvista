import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { LeagueSlug } from "./types";

type LeagueSubnavProps = {
  league: LeagueSlug;
};

const learnItems = ["How it works", "Glossary"] as const;

function exploreItemsFor(league: LeagueSlug): readonly string[] {
  const researchTab = league === "nba" ? "Playoff race" : "Arbitrage";
  return [
    "Matchups",
    "Props",
    "Leaders",
    "Standings",
    researchTab,
    "Futures",
  ];
}

export function LeagueSubnav({ league }: LeagueSubnavProps) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const exploreItems = exploreItemsFor(league);
  const allItems = [...exploreItems, ...learnItems];

  function itemPath(item: string): string | null {
    if (item === "Matchups") return `/${league}/matchups`;
    if (item === "Props" && league !== "nba")
      return `/${league}/prop_picks`;
    if (item === "Leaders" && (league === "wnba" || league === "mlb"))
      return `/${league}/leaders`;
    if (item === "Standings" && (league === "wnba" || league === "mlb"))
      return `/${league}/standings`;
    if (item === "Futures" && (league === "wnba" || league === "mlb"))
      return `/${league}/futures`;
    return null;
  }

  function isActive(item: string): boolean {
    if (item === "Matchups") return pathname.endsWith("/matchups");
    if (item === "Props") return pathname.includes("/prop_picks");
    if (item === "Leaders") return pathname.endsWith("/leaders");
    if (item === "Standings") return pathname.endsWith("/standings");
    if (item === "Futures") return pathname.endsWith("/futures");
    return false;
  }

  const activeItem = allItems.find(isActive) ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    // Defer so the opening click does not immediately dismiss the menu.
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function renderInlineItem(item: string) {
    const href = itemPath(item);
    const active = isActive(item);
    const className = active
      ? "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
      : href
        ? "rounded-md px-3 py-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white"
        : "cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium text-white/25";

    if (href) {
      return (
        <Link
          key={item}
          to={href}
          aria-current={active ? "page" : undefined}
          className={className}
        >
          {item}
        </Link>
      );
    }

    return (
      <button key={item} type="button" disabled className={className}>
        {item}
      </button>
    );
  }

  function renderMenuItem(item: string) {
    const href = itemPath(item);
    const active = isActive(item);
    const className = active
      ? "flex w-full items-center px-2.5 py-1.5 text-left text-sm font-medium text-white bg-white/10 no-underline"
      : href
        ? "flex w-full items-center px-2.5 py-1.5 text-left text-sm font-medium text-white no-underline hover:bg-white/5"
        : "flex w-full cursor-not-allowed items-center px-2.5 py-1.5 text-left text-sm font-medium text-white/40";

    if (href) {
      return (
        <li key={item} role="none">
          <Link
            role="menuitem"
            to={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={className}
          >
            {item}
          </Link>
        </li>
      );
    }

    return (
      <li key={item} role="none">
        <button type="button" role="menuitem" disabled className={className}>
          {item}
        </button>
      </li>
    );
  }

  return (
    <nav
      aria-label={`${league.toUpperCase()} sections`}
      className="relative z-30 mx-auto max-w-6xl overflow-visible px-4 py-6 sm:px-6"
    >
      <div
        ref={rootRef}
        className="flex gap-3 border-b border-white/10 pb-4 sm:gap-6 sm:overflow-x-auto"
      >
        <div className="relative sm:hidden">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className={
              activeItem
                ? "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white"
                : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
            }
          >
            {activeItem ?? "Sections"}
            <ChevronDown
              className="size-3.5 opacity-70"
              aria-hidden
              strokeWidth={1.75}
            />
          </button>
          {menuOpen ? (
            <ul
              id={menuId}
              role="menu"
              aria-label="Sections"
              className="absolute top-full left-0 z-50 mt-1.5 min-w-[11rem] rounded-lg border border-white/20 bg-neutral-950 py-1.5 shadow-lg"
            >
              <li
                role="presentation"
                className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/45 uppercase"
              >
                Explore
              </li>
              {exploreItems.map(renderMenuItem)}
              <li
                role="presentation"
                className="mt-2 border-t border-white/10 px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/45 uppercase"
              >
                Learn
              </li>
              {learnItems.map(renderMenuItem)}
            </ul>
          ) : null}
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <p className="px-1 text-[10px] font-medium tracking-[0.18em] text-white/35 uppercase">
            Explore
          </p>
          <div className="flex gap-1">{exploreItems.map(renderInlineItem)}</div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 border-l border-white/10 pl-6 sm:flex">
          <p className="px-1 text-[10px] font-medium tracking-[0.18em] text-white/35 uppercase">
            Learn
          </p>
          <div className="flex gap-1">{learnItems.map(renderInlineItem)}</div>
        </div>
      </div>
    </nav>
  );
}
