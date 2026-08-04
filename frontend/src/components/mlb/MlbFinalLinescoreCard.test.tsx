import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalLinescoreCard } from "./MlbFinalLinescoreCard";
import { mlbFinalDetail } from "./testFixtures";

describe("MlbFinalLinescoreCard", () => {
  it("renders the final linescore with winning, losing, and saving pitchers", () => {
    render(<MlbFinalLinescoreCard detail={mlbFinalDetail} />);

    expect(
      screen.getByTestId("mlb-final-linescore-card"),
    ).toBeInTheDocument();
    expect(screen.getByText(/W:\s*Brandon Pfaadt/)).toBeInTheDocument();
    expect(screen.getByText(/L:\s*Walker Buehler/)).toBeInTheDocument();
    expect(screen.getByText(/S:\s*Kevin Ginkel/)).toBeInTheDocument();
  });

  it("omits the save when the final game has no save decision", () => {
    render(
      <MlbFinalLinescoreCard
        detail={{
          ...mlbFinalDetail,
          decisions: { ...mlbFinalDetail.decisions!, save: null },
        }}
      />,
    );

    expect(screen.queryByText(/^S:/)).not.toBeInTheDocument();
  });
});
