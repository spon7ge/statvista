import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ApiWnbaLeaderCategory } from "@/shared/lib/api";
import { LeaderCategoryCard } from "./LeaderCategoryCard";

const category: ApiWnbaLeaderCategory = {
  key: "points",
  label: "Points",
  stat: "PTS",
  leaders: [
    {
      rank: 1,
      player_id: "1628932",
      name: "A'ja Wilson",
      team_abbrev: "LVA",
      gp: 25,
      value: "26.2",
    },
  ],
};

describe("LeaderCategoryCard", () => {
  it("links the player name to the player profile", () => {
    render(
      <MemoryRouter>
        <LeaderCategoryCard category={category} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "A'ja Wilson" })).toHaveAttribute(
      "href",
      "/wnba/player/1628932",
    );
  });

  it("renders white team abbrev with ESPN logo", () => {
    render(
      <MemoryRouter>
        <LeaderCategoryCard category={category} />
      </MemoryRouter>,
    );

    const abbrev = screen.getByText("LVA");
    expect(abbrev).toHaveClass("text-white");
    const logo = screen.getByRole("presentation");
    expect(logo).toHaveAttribute(
      "src",
      "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
    );
  });
});
