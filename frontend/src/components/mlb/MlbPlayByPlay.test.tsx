import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbPlayByPlay } from "./MlbPlayByPlay";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbPlayByPlay", () => {
  it("defaults to the current half-inning and shows scoring plays", () => {
    render(<MlbPlayByPlay detail={mlbLiveDetail} />);
    expect(screen.getByText("Betts singles")).toBeInTheDocument();
    expect(screen.getByText("Freeman homers (1)")).toBeInTheDocument();
    expect(screen.queryByText("Ohtani grounds out")).not.toBeInTheDocument();
  });
});
