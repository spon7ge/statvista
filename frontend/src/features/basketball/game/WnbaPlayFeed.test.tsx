import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { detail } from "../lib/testFixtures";
import { WnbaPlayFeed } from "./WnbaPlayFeed";

describe("WnbaPlayFeed", () => {
  it("defaults to scoring plays and can switch to all plays", async () => {
    const user = userEvent.setup();
    render(<WnbaPlayFeed detail={detail} />);

    expect(screen.getByTestId("wnba-play-feed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scoring plays/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // Scoring plays visible; non-scoring tip-off hidden under default filter.
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

  it("groups plays by period with ordinal labels", () => {
    render(<WnbaPlayFeed detail={detail} />);

    expect(screen.getByText("2nd")).toBeInTheDocument();
    expect(screen.getByText("1st")).toBeInTheDocument();
  });

  it("tints each period card with the first play's team color", () => {
    render(<WnbaPlayFeed detail={detail} />);

    // Newest-first: period 2 group starts with home scoring play; period 1 with away.
    const period2 = screen.getByTestId("wnba-play-period-2");
    const period1 = screen.getByTestId("wnba-play-period-1");
    expect(period2).toHaveStyle({ backgroundColor: detail.home.color });
    expect(period1).toHaveStyle({ backgroundColor: detail.away.color });
  });

  it("shows No plays available when the filtered list is empty", () => {
    render(<WnbaPlayFeed detail={{ ...detail, plays: [] }} />);
    expect(screen.getByText("No plays available")).toBeInTheDocument();
  });

  it("wraps content in GameSection", () => {
    render(<WnbaPlayFeed detail={detail} />);
    const feed = screen.getByTestId("wnba-play-feed");
    expect(feed.tagName.toLowerCase()).toBe("section");
    expect(feed).toHaveClass("rounded-xl", "bg-[#3a3d42]", "!p-3");
  });
});
