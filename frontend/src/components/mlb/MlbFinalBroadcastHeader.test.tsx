import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalBroadcastHeader } from "./MlbFinalBroadcastHeader";
import { mlbFinalDetail } from "./testFixtures";

describe("MlbFinalBroadcastHeader", () => {
  it("renders Today, Final, records, and split scores", () => {
    render(<MlbFinalBroadcastHeader detail={mlbFinalDetail} />);
    expect(screen.getByTestId("mlb-final-broadcast-header")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("58-55")).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbFinalDetail.away.score)),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/share/i)).toBeInTheDocument();
  });
});
