import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FuturesBoard } from "./FuturesBoard";
import type { ApiWnbaFuturesMarket } from "@/shared/lib/api";

const sampleMarkets: ApiWnbaFuturesMarket[] = [
  {
    id: "8146",
    name: "WNBA - Winner",
    display_name: "Finals Winner",
    provider: "DraftKings",
    entries: [
      {
        team_id: "8",
        abbrev: "NYL",
        name: "New York Liberty",
        logo_url: null,
        odds_american: "+250",
      },
    ],
  },
];

describe("FuturesBoard", () => {
  it("renders Finals Winner rows with odds and provider", () => {
    const { container } = render(
      <FuturesBoard
        markets={sampleMarkets}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText("Finals Winner")).toBeInTheDocument();
    expect(screen.getByText("New York Liberty")).toBeInTheDocument();
    expect(screen.getByText("+250")).toBeInTheDocument();
    expect(screen.getByText(/Odds by/)).toBeInTheDocument();
    expect(screen.getByText("DraftKings")).toBeInTheDocument();
    expect(container.querySelector("ul")?.className).toContain("sm:grid-cols-2");
  });

  it("shows loading skeletons", () => {
    render(<FuturesBoard markets={[]} isLoading />);
    expect(screen.getByLabelText("Loading futures")).toBeInTheDocument();
  });

  it("shows error copy when never loaded", () => {
    render(
      <FuturesBoard markets={[]} isError />,
    );
    expect(screen.getByText("Unable to load futures")).toBeInTheDocument();
  });

  it("shows empty copy when no markets", () => {
    render(
      <FuturesBoard markets={[]} />,
    );
    expect(screen.getByText("No futures listed")).toBeInTheDocument();
  });
});
