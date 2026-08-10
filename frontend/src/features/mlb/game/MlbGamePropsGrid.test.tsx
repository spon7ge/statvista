import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiMlbGamePropsResponse } from "@/shared/lib/api";
import { MlbGamePropsGrid } from "./MlbGamePropsGrid";

type Category = ApiMlbGamePropsResponse["categories"][number];
type Player = Category["players"][number];

function player(partial: Partial<Player> & Pick<Player, "player_name">): Player {
  return {
    team_abbrev: "NYY",
    headshot_url: null,
    line: 0.5,
    over: { american: 270, book: "fanduel" },
    under: null,
    ...partial,
  };
}

const sixPlayers: Player[] = [
  player({ player_name: "A. Judge" }),
  player({
    player_name: "J. Soto",
    over: { american: -110, book: "draftkings" },
  }),
  player({
    player_name: "G. Torres",
    over: null,
    under: { american: 100, book: "pinnacle" },
  }),
  player({
    player_name: "A. Volpe",
    over: { american: 180, book: "draftkings" },
  }),
  player({
    player_name: "A. Verdugo",
    over: { american: -105, book: "prophetx" },
  }),
  player({
    player_name: "G. Stanton",
    over: { american: 320, book: "novig" },
  }),
];

const categories: Category[] = [
  {
    stat: "home_runs",
    label: "Home Runs",
    players: sixPlayers,
  },
];

describe("MlbGamePropsGrid", () => {
  it("renders line, over odds, and book name", () => {
    render(<MlbGamePropsGrid categories={categories} />);
    expect(screen.getByText("Home Runs")).toBeInTheDocument();
    expect(screen.getAllByText("0.5").length).toBeGreaterThan(0);
    expect(screen.getByText("+270")).toBeInTheDocument();
    expect(screen.getByText("FanDuel")).toBeInTheDocument();
  });

  it("calls onPlayerClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const onPlayerClick = vi.fn();
    render(
      <MlbGamePropsGrid
        categories={categories}
        onPlayerClick={onPlayerClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: /A\. Judge/i }));
    expect(onPlayerClick).toHaveBeenCalled();
    expect(onPlayerClick.mock.calls[0]?.[0]).toMatchObject({
      player_name: "A. Judge",
    });
  });

  it("show more expands beyond 5 rows", async () => {
    const user = userEvent.setup();
    render(<MlbGamePropsGrid categories={categories} />);

    expect(screen.getByText("A. Judge")).toBeInTheDocument();
    expect(screen.getByText("A. Verdugo")).toBeInTheDocument();
    expect(screen.queryByText("G. Stanton")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByText("G. Stanton")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.queryByText("G. Stanton")).not.toBeInTheDocument();
  });

  it("shows empty copy when there are no categories", () => {
    render(<MlbGamePropsGrid categories={[]} />);
    expect(
      screen.getByText("No props available for this matchup"),
    ).toBeInTheDocument();
  });

  it("shows short error when categories are empty and error is set", () => {
    render(
      <MlbGamePropsGrid categories={[]} error="Failed to load props" />,
    );
    expect(screen.getByText("Failed to load props")).toBeInTheDocument();
    expect(
      screen.queryByText("No props available for this matchup"),
    ).not.toBeInTheDocument();
  });

  it("still renders categories when soft error is set", () => {
    render(
      <MlbGamePropsGrid
        categories={categories}
        error="odds_api_unavailable"
      />,
    );
    expect(screen.getByText("Home Runs")).toBeInTheDocument();
    expect(screen.getByText("A. Judge")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-props-soft-error")).toHaveTextContent(
      "Some book quotes may be incomplete",
    );
    expect(
      screen.queryByText("No props available for this matchup"),
    ).not.toBeInTheDocument();
  });

  it("shows loading copy while pending", () => {
    render(<MlbGamePropsGrid categories={[]} isPending />);
    expect(screen.getByText("Loading props…")).toBeInTheDocument();
  });
});
