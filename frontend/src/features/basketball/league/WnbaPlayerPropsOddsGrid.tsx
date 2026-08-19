import type { ApiWnbaPropBookMainQuote, ApiWnbaPropRow } from "@/shared/lib/api";
import { WNBA_BOOK_LABELS } from "@/features/basketball/lib/wnbaBookLabels";
import { formatAmericanOdds } from "@/features/basketball/lib/wnbaOddsBoard";

export const WNBA_PLAYER_PROP_GRID_BOOKS = [
  "prophetx",
  "novig",
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "kalshi",
  "fliff",
  "bet365",
  "pinnacle",
] as const;

function formatMainAmerican(odds: number | null): string {
  if (odds == null) return "—";
  return formatAmericanOdds(odds);
}

function MainQuoteCell({
  quote,
}: {
  quote: ApiWnbaPropBookMainQuote | null | undefined;
}) {
  if (!quote) {
    return <span className="text-white/35">NL</span>;
  }
  return (
    <div className="font-mono text-sm text-white">
      <div>
        O {quote.line} ({formatMainAmerican(quote.over_american)})
      </div>
      <div>
        U {quote.line} ({formatMainAmerican(quote.under_american)})
      </div>
    </div>
  );
}

export function WnbaPlayerPropsOddsGrid({
  markets,
}: {
  markets: ApiWnbaPropRow[];
}) {
  return (
    <div className="overflow-x-auto" data-testid="wnba-player-props-odds-grid">
      <table className="w-full min-w-[72rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 text-[11px] font-medium uppercase tracking-wide text-white/45">
            <th className="px-3 py-2 font-medium">Market</th>
            {WNBA_PLAYER_PROP_GRID_BOOKS.map((book) => (
              <th key={book} className="px-3 py-2 font-medium">
                {WNBA_BOOK_LABELS[book]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {markets.map((row) => (
            <tr key={row.stat} className="border-b border-white/5">
              <th scope="row" className="px-3 py-3 font-normal">
                <div className="text-sm font-semibold text-white">{row.stat}</div>
                <div className="font-mono text-xs text-white/45">{row.line}</div>
              </th>
              {WNBA_PLAYER_PROP_GRID_BOOKS.map((book) => (
                <td key={book} className="px-3 py-3 align-top">
                  <MainQuoteCell quote={row.books_main[book]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
