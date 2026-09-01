import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";

export type WnbaPropBoardSortKey =
  | "player"
  | "line"
  | "odds"
  | "ip"
  | "l5"
  | "l10"
  | "l15"
  | "h2h";

export type WnbaPropBoardSort = {
  key: WnbaPropBoardSortKey;
  direction: "asc" | "desc";
};

export const BOOK_CHIP_ORDER = [
  "prophetx",
  "novig",
  "pinnacle",
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "bet365",
  "kalshi",
  "fliff",
  "prizepicks",
  "underdog",
] as const;

export const DFS_CHIP_ORDER = ["prizepicks", "underdog"] as const;

export function orderedWnbaBoardBooks(
  books: ApiWnbaPropBoardRow["books"],
): ApiWnbaPropBoardRow["books"] {
  const rank = new Map<string, number>(
    BOOK_CHIP_ORDER.map((book, index) => [book, index]),
  );
  return [...books].sort((a, b) => {
    const aRank = rank.get(a.book) ?? BOOK_CHIP_ORDER.length;
    const bRank = rank.get(b.book) ?? BOOK_CHIP_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    return a.book.localeCompare(b.book);
  });
}

export function orderedWnbaDfsBooks(
  dfs: ApiWnbaPropBoardRow["dfs"],
): ApiWnbaPropBoardRow["dfs"] {
  const rank = new Map<string, number>(
    DFS_CHIP_ORDER.map((book, index) => [book, index]),
  );
  return [...dfs].sort((a, b) => {
    const aRank = rank.get(a.book) ?? DFS_CHIP_ORDER.length;
    const bRank = rank.get(b.book) ?? DFS_CHIP_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    return a.book.localeCompare(b.book);
  });
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: "asc" | "desc",
): number {
  if (a == null && b == null) return 0;
  // Null enrichments always park last, including when the column is reversed.
  if (a == null) return 1;
  if (b == null) return -1;
  const delta = a - b;
  return direction === "asc" ? delta : -delta;
}

function compareNullableDate(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

function firstOddsAmerican(row: ApiWnbaPropBoardRow): number | null {
  const quote = orderedWnbaBoardBooks(row.books).find((book) => book.american != null);
  return quote?.american ?? null;
}

export function compareWnbaPropBoardDefault(
  a: ApiWnbaPropBoardRow,
  b: ApiWnbaPropBoardRow,
): number {
  const start = compareNullableDate(a.game_start_at, b.game_start_at);
  if (start !== 0) return start;
  const name = a.player_name.localeCompare(b.player_name);
  if (name !== 0) return name;
  const stat = a.stat.localeCompare(b.stat);
  if (stat !== 0) return stat;
  if (a.side !== b.side) return a.side === "over" ? -1 : 1;
  return a.line - b.line;
}

function columnValue(
  row: ApiWnbaPropBoardRow,
  key: WnbaPropBoardSortKey,
): number | string | null {
  switch (key) {
    case "player":
      return row.player_name;
    case "line":
      return row.line;
    case "odds":
      return firstOddsAmerican(row);
    case "ip":
      return row.ip_pct;
    case "l5":
      return row.hit_l5;
    case "l10":
      return row.hit_l10;
    case "l15":
      return row.hit_l15;
    case "h2h":
      return row.hit_h2h;
  }
}

export function sortWnbaPropBoardRows(
  rows: ApiWnbaPropBoardRow[],
  sort: WnbaPropBoardSort | null,
): ApiWnbaPropBoardRow[] {
  return [...rows].sort((a, b) => {
    if (sort) {
      const aValue = columnValue(a, sort.key);
      const bValue = columnValue(b, sort.key);
      if (typeof aValue === "string" || typeof bValue === "string") {
        const aName = typeof aValue === "string" ? aValue : "";
        const bName = typeof bValue === "string" ? bValue : "";
        const name = aName.localeCompare(bName);
        if (name !== 0) return sort.direction === "asc" ? name : -name;
      } else {
        const numeric = compareNullableNumber(aValue, bValue, sort.direction);
        if (numeric !== 0) return numeric;
      }
    }
    return compareWnbaPropBoardDefault(a, b);
  });
}
