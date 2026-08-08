import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { MlbLeaderCategoryCard } from "./MlbLeaderCategoryCard";

const category: ApiMlbLeaderCategory = {
  key: "avg",
  label: "Batting Average",
  stat: "AVG",
  leaders: [
    {
      rank: 1,
      player_id: "592450",
      name: "Aaron Judge",
      team_abbrev: "NYY",
      gp: null,
      value: ".345",
    },
  ],
};

describe("MlbLeaderCategoryCard", () => {
  it("uses MLB typography and shows players as plain text", () => {
    render(<MlbLeaderCategoryCard category={category} />);

    expect(screen.getByRole("heading", { name: "Batting Average" })).toHaveClass(
      "text-[18px]",
    );
    expect(screen.getByText("Aaron Judge")).toHaveClass("text-[18px]");
    expect(screen.getByRole("columnheader", { name: "Player" })).toHaveClass(
      "text-[14px]",
    );
    expect(screen.getByText("—")).toHaveClass("text-[14px]");
    expect(document.querySelector('a[href*="/mlb/player"]')).toBeNull();
  });
});
