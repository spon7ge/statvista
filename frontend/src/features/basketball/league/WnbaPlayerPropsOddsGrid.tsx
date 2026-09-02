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
    return <span className="text-c3">NL</span>;
  }
  return (
    <div className="text-sm text-c3">
      <div>
        <div>O {quote.line}</div>
        <div className="text-c3">
          ({formatMainAmerican(quote.over_american)})
        </div>
      </div>
      <div className="mt-1">
        <div>U {quote.line}</div>
        <div className="text-c3">
          ({formatMainAmerican(quote.under_american)})
        </div>
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
          <tr className="border-b border-line text-[12px] font-bold uppercase tracking-wide text-c3">
            <th className="px-3 py-2 font-bold">Market</th>
            {WNBA_PLAYER_PROP_GRID_BOOKS.map((book) => (
              <th key={book} className="px-3 py-2 font-bold">
                {WNBA_BOOK_LABELS[book]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {markets.map((row) => (
            <tr key={row.stat} className="border-b border-line">
              <th scope="row" className="px-3 py-3 font-normal">
                <div className="text-sm font-semibold text-c3">{row.stat}</div>
                <div className="text-base font-bold text-c3">{row.line}</div>
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
