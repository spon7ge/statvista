import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbPregameCenter } from "./MlbPregameCenter";
import { mlbScheduledDetail } from "./testFixtures";

describe("MlbPregameCenter", () => {
  it("renders header and preview stub by default", () => {
    render(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(screen.getByTestId("mlb-pregame-center")).toBeInTheDocument();
    expect(
      screen.getByTestId("mlb-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByText(/preview coming soon/i)).toBeInTheDocument();
  });

  it("switches stub panels on tab click", async () => {
    const user = userEvent.setup();
    render(<MlbPregameCenter detail={mlbScheduledDetail} />);
    await user.click(
      screen.getByRole("tab", { name: /washington nationals/i }),
    );
    expect(
      screen.getByText(/washington nationals preview coming soon/i),
    ).toBeInTheDocument();
  });
});
