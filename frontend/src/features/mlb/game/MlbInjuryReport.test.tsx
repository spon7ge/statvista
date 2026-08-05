import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbInjuryReport } from "./MlbInjuryReport";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbInjuryReport", () => {
  it("renders away and home injuries", () => {
    render(
      <MlbInjuryReport
        detail={{
          ...mlbScheduledDetail,
          away: {
            ...mlbScheduledDetail.away,
            logoUrl: "https://example.com/wsh.svg",
          },
          home: {
            ...mlbScheduledDetail.home,
            logoUrl: "https://example.com/phi.svg",
          },
          injuries: {
            away: [
              {
                name: "Dalton Rushing",
                position: "C",
                status: "10-Day IL",
                detail: "Arm",
              },
            ],
            home: [
              {
                name: "Max Fried",
                position: "P",
                status: "Day-To-Day",
                detail: "Blister",
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByTestId("mlb-injury-report")).toBeInTheDocument();
    expect(screen.getByText("Dalton Rushing")).toBeInTheDocument();
    expect(screen.getByText("Max Fried")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Injuries" })).toBeInTheDocument();
    expect(screen.getByText("WSH")).toBeInTheDocument();
    expect(screen.getByText("PHI")).toBeInTheDocument();
    const section = screen.getByTestId("mlb-injury-report");
    expect(section.querySelector('img[src="https://example.com/wsh.svg"]')).toBeTruthy();
    expect(section.querySelector('img[src="https://example.com/phi.svg"]')).toBeTruthy();
  });

  it("shows None listed for empty side", () => {
    render(
      <MlbInjuryReport
        detail={{
          ...mlbScheduledDetail,
          injuries: {
            away: [
              {
                name: "Dalton Rushing",
                position: "C",
                status: "10-Day IL",
                detail: "Arm",
              },
            ],
            home: [],
          },
        }}
      />,
    );
    expect(screen.getByText("None listed")).toBeInTheDocument();
  });

  it("hides when injuries is null", () => {
    render(
      <MlbInjuryReport
        detail={{ ...mlbScheduledDetail, injuries: null }}
      />,
    );
    expect(screen.queryByTestId("mlb-injury-report")).not.toBeInTheDocument();
  });
});
