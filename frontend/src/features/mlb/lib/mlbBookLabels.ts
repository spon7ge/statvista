export const MLB_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  kalshi: "Kalshi",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  betonline: "BetOnline",
  pinnacle: "Pinnacle",
};

export function bookDisplayName(book: string): string {
  return MLB_BOOK_LABELS[book] ?? book;
}
