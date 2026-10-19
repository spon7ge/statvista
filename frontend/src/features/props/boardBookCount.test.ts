import { describe, expect, it } from "vitest";
import {
  boardBookCount,
  collectBoardBookCountOptions,
  rowMatchesBookCounts,
} from "./boardBookCount";

const chip = (
  book: string,
  american: number | null,
  line: number | null = 1.5,
) => ({ book, american, line });

describe("boardBookCount", () => {
  it("counts the anchor plus every odds chip at the row line", () => {
    expect(
      boardBookCount({
        line: 1.5,
        books: [chip("draftkings", -110), chip("fanduel", -108)],
      }),
    ).toBe(3);
  });

  it("counts a lone anchor as one book", () => {
    expect(boardBookCount({ line: 1.5, books: [] })).toBe(1);
  });

  it("skips chips with no posted price or a different line", () => {
    expect(
      boardBookCount({
        line: 1.5,
        books: [
          chip("draftkings", null),
          chip("fanduel", -108, 2.5),
          chip("prizepicks", null, 1.5),
        ],
      }),
    ).toBe(2);
  });
});

describe("collectBoardBookCountOptions", () => {
  it("lists every count from 1 through the fullest row", () => {
    expect(
      collectBoardBookCountOptions([
        { line: 1.5, books: [] },
        { line: 1.5, books: [chip("draftkings", -110), chip("fanduel", -108)] },
      ]),
    ).toEqual([
      { value: "1", label: "1 book" },
      { value: "2", label: "2 books" },
      { value: "3", label: "3 books" },
    ]);
  });

  it("returns no options when the board is empty", () => {
    expect(collectBoardBookCountOptions([])).toEqual([]);
  });
});

describe("rowMatchesBookCounts", () => {
  const row = { line: 1.5, books: [chip("draftkings", -110)] };

  it("keeps every row when no counts are selected", () => {
    expect(rowMatchesBookCounts(row, undefined)).toBe(true);
    expect(rowMatchesBookCounts(row, new Set())).toBe(true);
  });

  it("keeps a row only when its count is selected", () => {
    expect(rowMatchesBookCounts(row, new Set(["2"]))).toBe(true);
    expect(rowMatchesBookCounts(row, new Set(["1", "3"]))).toBe(false);
  });
});
