import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiWnbaGamePropsResponse } from "@/shared/lib/api";
import { WnbaGamePropsGrid } from "./WnbaGamePropsGrid";

type Category = ApiWnbaGamePropsResponse["categories"][number];
type Player = Category["players"][number];

function player(partial: Partial<Player> & Pick<Player, "player_name">): Player {
  return {
    team_abbrev: "NYL",
    headshot_url: null,
    line: 18.5,
    over: { american: 270, book: "fanduel" },
    under: null,
    ...partial,
  };
}

const sixPlayers: Player[] = [
  player({ player_name: "Breanna Stewart" }),
  player({
    player_name: "Sabrina Ionescu",
    over: { american: -110, book: "draftkings" },
  }),
  player({
    player_name: "Jonquel Jones",
    over: null,
    under: { american: 100, book: "pinnacle" },
  }),
  player({
    player_name: "Betnijah Laney",
    over: { american: 180, book: "draftkings" },
  }),
  player({
    player_name: "Courtney Vandersloot",
    over: { american: -105, book: "prophetx" },
  }),
  player({
    player_name: "Natasha Cloud",
    over: { american: 320, book: "novig" },
  }),
];

const categories: Category[] = [
  {
    stat: "points",
    label: "Points",
    players: sixPlayers,
  },
];

describe("WnbaGamePropsGrid", () => {
  it("renders line, over odds, and book name", () => {
    render(<WnbaGamePropsGrid categories={categories} />);
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getAllByText("18.5").length).toBeGreaterThan(0);
    expect(screen.getByText("+270")).toBeInTheDocument();
    expect(screen.getByText("FanDuel")).toBeInTheDocument();
  });

  it("calls onPlayerClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const onPlayerClick = vi.fn();
    render(
      <WnbaGamePropsGrid
        categories={categories}
        onPlayerClick={onPlayerClick}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Breanna Stewart/i }),
    );
    expect(onPlayerClick).toHaveBeenCalled();
    expect(onPlayerClick.mock.calls[0]?.[0]).toMatchObject({
      player_name: "Breanna Stewart",
    });
  });

  it("show more expands beyond 5 rows", async () => {
    const user = userEvent.setup();
    render(<WnbaGamePropsGrid categories={categories} />);

    expect(screen.getByText("Breanna Stewart")).toBeInTheDocument();
    expect(screen.getByText("Courtney Vandersloot")).toBeInTheDocument();
    expect(screen.queryByText("Natasha Cloud")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByText("Natasha Cloud")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.queryByText("Natasha Cloud")).not.toBeInTheDocument();
  });

  it("shows empty copy when there are no categories", () => {
    render(<WnbaGamePropsGrid categories={[]} />);
    expect(
      screen.getByText("No props available for this matchup"),
    ).toBeInTheDocument();
  });

  it("shows short error when categories are empty and error is set", () => {
    render(
      <WnbaGamePropsGrid categories={[]} error="Failed to load props" />,
    );
    expect(screen.getByText("Failed to load props")).toBeInTheDocument();
    expect(
      screen.queryByText("No props available for this matchup"),
    ).not.toBeInTheDocument();
  });

  it("still renders categories when soft error is set", () => {
    render(
      <WnbaGamePropsGrid
        categories={categories}
        error="odds_api_unavailable"
      />,
    );
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("Breanna Stewart")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-game-props-soft-error")).toHaveTextContent(
      "Some book quotes may be incomplete",
    );
    expect(
      screen.queryByText("No props available for this matchup"),
    ).not.toBeInTheDocument();
  });

  it("shows loading copy while pending", () => {
    render(<WnbaGamePropsGrid categories={[]} isPending />);
    expect(screen.getByText("Loading props…")).toBeInTheDocument();
  });

  it("packs category cards into independent columns so short cards do not leave a gap", () => {
    render(
      <WnbaGamePropsGrid
        categories={[
          {
            stat: "points",
            label: "Points",
            players: sixPlayers,
          },
          {
            stat: "rebounds",
            label: "Rebounds",
            players: [
              player({ player_name: "Short A" }),
              player({ player_name: "Short B" }),
            ],
          },
          {
            stat: "assists",
            label: "Assists",
            players: [player({ player_name: "Below Short" })],
          },
        ]}
      />,
    );

    const columns = screen.getByTestId("wnba-game-props-columns");
    expect(columns.className).toMatch(/lg:columns-2/);
    expect(screen.getByText("Short A")).toBeInTheDocument();
    expect(screen.getByText("Below Short")).toBeInTheDocument();
    expect(screen.queryByText("Natasha Cloud")).not.toBeInTheDocument();
  });
});
