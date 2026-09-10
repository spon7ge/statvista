const LINKED_SOURCES: { name: string; href: string; usedFor: string }[] = [
  {
    name: "ESPN",
    href: "https://www.espn.com/",
    usedFor:
      "WNBA scoreboard, standings, game summary / win probability; MLB win-probability bridge",
  },
  {
    name: "stats.wnba.com",
    href: "https://stats.wnba.com/",
    usedFor: "Season leaders, player bio / averages / gamelog",
  },
  {
    name: "MLB Stats API",
    href: "https://statsapi.mlb.com/",
    usedFor: "MLB scoreboard and live/final game feeds",
  },
  {
    name: "RotoWire",
    href: "https://www.rotowire.com/",
    usedFor: "Projected starters / lineups",
  },
];

const PLAIN_SOURCES: { name: string; usedFor: string }[] = [
  {
    name: "ParlayAPI / Sharp",
    usedFor: "Sportsbook odds (spreads, totals, player props)",
  },
  {
    name: "Supabase (Postgres)",
    usedFor: "PrizePicks / Underdog snapshots and other odds tables",
  },
];

export function AboutContent() {
  return (
    <div className="max-w-3xl space-y-10 text-[16px] leading-relaxed text-c3">
      <div className="space-y-4">
        <p>
          <strong className="text-c3">statvista</strong> is a research site for
          MLB and WNBA player props and games. Compare DFS lines to sportsbooks
          in one place.
        </p>
        <p>
          Educational and research use only — not a tipster feed and not a
          betting ticket. Sports betting involves risk. Gamble responsibly.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="about-what">
        <h2 id="about-what" className="font-display text-[20px] text-c3">
          What you can do
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Props</strong> — DFS-anchored player lines next to
            sportsbook odds
          </li>
          <li>
            <strong>Legs</strong> — priced PrizePicks / Underdog entry
            shortlists
          </li>
          <li>
            <strong>Games</strong> — dated slates and game centers
          </li>
        </ul>
        <p className="text-[14px] text-c3">
          Arbitrage is a shell (not wired yet). NBA is a placeholder.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="about-stack">
        <h2 id="about-stack" className="font-display text-[20px] text-c3">
          Tech stack
        </h2>
        <p>
          React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic ·
          Postgres (Supabase or local)
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="about-sources">
        <h2 id="about-sources" className="font-display text-[20px] text-c3">
          Data sources
        </h2>
        <ul className="space-y-3">
          {LINKED_SOURCES.map((source) => (
            <li key={source.name}>
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.name}
              </a>
              <span className="text-c3"> — {source.usedFor}</span>
            </li>
          ))}
          {PLAIN_SOURCES.map((source) => (
            <li key={source.name}>
              <span className="font-medium text-c3">{source.name}</span>
              <span className="text-c3"> — {source.usedFor}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
