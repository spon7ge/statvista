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
    expect(screen.queryByRole("columnheader", { name: "GP" })).toBeNull();
    expect(document.querySelector('a[href*="/mlb/player"]')).toBeNull();
  });

  it("renders white team abbrev with mlbstatic logo", () => {
    render(<MlbLeaderCategoryCard category={category} />);

    const abbrev = screen.getByText("NYY");
    expect(abbrev).toHaveClass("text-white");
    const logo = screen.getByRole("presentation");
    expect(logo).toHaveAttribute(
      "src",
      "https://www.mlbstatic.com/team-logos/147.svg",
    );
  });
});
