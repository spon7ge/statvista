import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildGameDetailFixture } from "../lib/testFixtures";
import { NbaLiveCenter } from "./NbaLiveCenter";

describe("NbaLiveCenter", () => {
  it("renders the NBA in-game shell and broadcast header", () => {
    const detail = buildGameDetailFixture({ league: "nba", status: "live" });

    render(<NbaLiveCenter detail={detail} />);

    expect(screen.getByTestId("nba-live-center")).toBeInTheDocument();
    expect(screen.getByTestId("nba-broadcast-header")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByTestId("wnba-live-center")).not.toBeInTheDocument();
  });
});
