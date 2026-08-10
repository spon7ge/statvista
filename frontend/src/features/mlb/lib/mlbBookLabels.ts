export const MLB_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  pinnacle: "Pinnacle",
};

export function bookDisplayName(book: string): string {
  return MLB_BOOK_LABELS[book] ?? book;
}
