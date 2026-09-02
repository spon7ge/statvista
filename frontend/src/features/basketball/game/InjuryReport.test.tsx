import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InjuryReport } from "./InjuryReport";
import { buildScheduledDetail } from "../lib/testFixtures";

describe("InjuryReport", () => {
  it("renders injury rows", () => {
    render(
      <InjuryReport
        detail={buildScheduledDetail({
          injuries: {
            away: [],
            home: [
              {
                name: "Nyara Sabally",
                position: "F",
                status: "Out",
                detail: "Ribs",
              },
            ],
          },
        })}
      />,
    );
    const heading = screen.getByRole("heading", { name: /Injury report/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-semibold");
    expect(screen.getByText("Nyara Sabally")).toBeInTheDocument();
    expect(screen.getByText(/Out/)).toBeInTheDocument();
    expect(screen.getByText(/Ribs/)).toBeInTheDocument();
  });

  it("shows team logo and white abbrev headers", () => {
    render(
      <InjuryReport
        detail={buildScheduledDetail({
          away: {
            id: "16",
            abbrev: "MIN",
            name: "Minnesota Lynx",
            score: null,
            record: null,
            last10: null,
            color: "#0C2340",
            logoUrl: "https://example.com/min.png",
          },
          home: {
            id: "129154",
            abbrev: "TOR",
            name: "Toronto Tempo",
            score: null,
            record: null,
            last10: null,
            color: "#CE1141",
            logoUrl: "https://example.com/tor.png",
          },
          injuries: {
            away: [],
            home: [
              {
                name: "Nyara Sabally",
                position: "F",
                status: "Out",
                detail: "Ribs",
              },
            ],
          },
        })}
      />,
    );

    const minHeader = screen.getByText("MIN").closest("h3");
    const torHeader = screen.getByText("TOR").closest("h3");
    expect(minHeader).toHaveClass("text-c3", "font-semibold");
    expect(torHeader).toHaveClass("text-c3", "font-semibold");
    expect(
      document.querySelector('img[src="https://example.com/min.png"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('img[src="https://example.com/tor.png"]'),
    ).toBeTruthy();
    expect(minHeader).not.toHaveAttribute("style");
  });

  it("shows None listed for empty side when other side has injuries", () => {
    render(
      <InjuryReport
        detail={buildScheduledDetail({
          injuries: {
            away: [],
            home: [
              {
                name: "Nyara Sabally",
                position: "F",
                status: "Out",
                detail: "Ribs",
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("None listed")).toBeInTheDocument();
  });

  it("renders nothing without injuries", () => {
    const { container } = render(
      <InjuryReport detail={buildScheduledDetail({ injuries: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
