export type BoardBookChip = {
  book: string;
  american: number | null;
  line?: number | null;
};

const PRIZEPICKS_POSTED_AMERICAN = -137;

/**
 * PrizePicks rows often omit an American. The board still paints -137, so
 * that chip counts as a book the same way the odds column does.
 */
function postedAmerican(book: string, american: number | null): number | null {
  if (book === "prizepicks") return PRIZEPICKS_POSTED_AMERICAN;
  return american;
}

function chipCounts(chip: BoardBookChip, line: number): boolean {
  if (postedAmerican(chip.book, chip.american) == null) return false;
  return chip.line == null || chip.line === line;
}

/** Anchor plus every other book the odds column would show for this row. */
export function boardBookCount(row: {
  line: number;
  books: readonly BoardBookChip[];
}): number {
  let others = 0;
  for (const chip of row.books) {
    if (chipCounts(chip, row.line)) others += 1;
  }
  return 1 + others;
}

export function collectBoardBookCountOptions(
  rows: readonly { line: number; books: readonly BoardBookChip[] }[],
): { value: string; label: string }[] {
  let max = 0;
  for (const row of rows) {
    const count = boardBookCount(row);
    if (count > max) max = count;
  }
  const options: { value: string; label: string }[] = [];
  for (let n = 1; n <= max; n += 1) {
    options.push({
      value: String(n),
      label: n === 1 ? "1 book" : `${n} books`,
    });
  }
  return options;
}

export function rowMatchesBookCounts(
  row: { line: number; books: readonly BoardBookChip[] },
  bookCounts: Set<string> | undefined,
): boolean {
  if (!bookCounts || bookCounts.size === 0) return true;
  return bookCounts.has(String(boardBookCount(row)));
}
