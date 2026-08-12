export const WNBA_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  pinnacle: "Pinnacle",
  betmgm: "BetMGM",
  caesars: "Caesars",
  betrivers: "BetRivers",
  bet365: "bet365",
};

export function bookDisplayName(book: string): string {
  return WNBA_BOOK_LABELS[book] ?? book;
}
