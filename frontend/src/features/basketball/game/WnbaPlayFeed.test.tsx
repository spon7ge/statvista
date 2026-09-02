import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { detail } from "../lib/testFixtures";
import {
  periodClockLabel,
  relativeLuminance,
  splitPlayText,
  WnbaPlayFeed,
} from "./WnbaPlayFeed";

describe("splitPlayText", () => {
  it("moves Assisted by below the play without parentheses", () => {
    expect(
      splitPlayText("C. Zandalasini makes 25' three (Assisted by V. Burton)"),
    ).toEqual({
      headline: "C. Zandalasini makes 25' three",
      assist: "Assisted by V. Burton",
    });
  });

  it("handles ESPN '(Name assists)' parenthetical", () => {
    expect(
      splitPlayText("C. Zandalasini makes 25' three (V. Burton assists)"),
    ).toEqual({
      headline: "C. Zandalasini makes 25' three",
      assist: "Assisted by V. Burton",
    });
  });

  it("returns null assist when none is present", () => {
    expect(splitPlayText("E. Wheeler makes 11' pullup")).toEqual({
      headline: "E. Wheeler makes 11' pullup",
      assist: null,
    });
  });
});

describe("periodClockLabel", () => {
  it("formats quarter clocks like 1Q 09:39", () => {
    expect(periodClockLabel(1, "09:39")).toBe("1Q 09:39");
    expect(periodClockLabel(5, "2:00")).toBe("OT 2:00");
  });
});

describe("relativeLuminance", () => {
  it("treats white as light and near-black as dark", () => {
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(0.9);
    expect(relativeLuminance("#1a0a2e")).toBeLessThan(0.2);
  });
});

describe("WnbaPlayFeed", () => {
  it("defaults to scoring plays and can switch to all plays", async () => {
    const user = userEvent.setup();
    render(<WnbaPlayFeed detail={detail} />);

    expect(screen.getByTestId("wnba-play-feed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scoring plays/i }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByText("B. Player makes three point shot"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A. Player makes two point shot"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Tip off won by Golden State"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all plays/i }));

    expect(
      screen.getByRole("button", { name: /all plays/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Tip off won by Golden State"),
    ).toBeInTheDocument();
  });

  it("renders one team-colored card per play with 1Q clock and score", () => {
    render(<WnbaPlayFeed detail={detail} />);

    const card = screen.getByTestId("wnba-play-card-pl2");
    expect(card).toHaveStyle({ backgroundColor: detail.away.color });
    expect(screen.getByText("1Q 8:00")).toBeInTheDocument();
    expect(screen.getByText("2-0")).toBeInTheDocument();
  });

  it("lists scoring plays chronologically (oldest first)", () => {
    render(<WnbaPlayFeed detail={detail} />);
    const cards = screen.getAllByTestId(/wnba-play-card-/);
    expect(cards.map((el) => el.getAttribute("data-testid"))).toEqual([
      "wnba-play-card-pl2",
      "wnba-play-card-pl3",
    ]);
  });

  it("shows assist line when play text includes (Name assists)", () => {
    render(
      <WnbaPlayFeed
        detail={{
          ...detail,
          plays: [
            {
              id: "assist-1",
              teamId: "away1",
              period: 1,
              clock: "09:39",
              text: "C. Zandalasini makes 25' three (V. Burton assists)",
              scoring: true,
              awayScore: 3,
              homeScore: 0,
              shooting: true,
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("C. Zandalasini makes 25' three"),
    ).toBeInTheDocument();
    expect(screen.getByText("Assisted by V. Burton")).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });

  it("shows No plays available when the filtered list is empty", () => {
    render(<WnbaPlayFeed detail={{ ...detail, plays: [] }} />);
    expect(screen.getByText("No plays available")).toBeInTheDocument();
  });

  it("uses a white selected toggle pill", () => {
    render(<WnbaPlayFeed detail={detail} />);
    expect(screen.getByRole("button", { name: /scoring plays/i })).toHaveClass(
      "bg-c2",
      "text-black",
    );
  });
});
