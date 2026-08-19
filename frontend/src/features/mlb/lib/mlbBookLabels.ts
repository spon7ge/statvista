export const MLB_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  kalshi: "Kalshi",
  fliff: "Fliff",
  bet365: "bet365",
  pinnacle: "Pinnacle",
};

export function bookDisplayName(book: string): string {
  return MLB_BOOK_LABELS[book] ?? book;
}
