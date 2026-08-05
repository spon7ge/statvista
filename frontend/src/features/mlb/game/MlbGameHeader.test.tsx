import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbGameHeader } from "./MlbGameHeader";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbGameHeader", () => {
  it("renders team names from the live detail view", () => {
    render(<MlbGameHeader detail={mlbLiveDetail} />);
    expect(screen.getByText("Boston Red Sox")).toBeInTheDocument();
  });
});
