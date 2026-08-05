import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbPitchZone, ZONE_CENTER_X, ZONE_CENTER_Y } from "./MlbPitchZone";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbPitchZone", () => {
  it("renders zone, pitch markers, footer mph/type, and spin when present", () => {
    render(<MlbPitchZone situation={mlbLiveDetail.situation!} />);
    expect(screen.getByTestId("mlb-pitch-zone")).toBeInTheDocument();
    expect(screen.queryByText(/^Pitch zone$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Ball$/i)).toBeInTheDocument();
    expect(screen.getByText(/Called Strike/i)).toBeInTheDocument();
    expect(screen.getByText(/95\.2 mph/i)).toBeInTheDocument();
    expect(screen.getByText(/Spin:\s*2286 rpm,\s*63 deg/i)).toBeInTheDocument();
    expect(
      screen.getByTestId("mlb-pitch-zone-batter-silhouette"),
    ).toBeInTheDocument();
  });

  it("omits spin line when spin fields are null", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          spinRate: null,
          spinDirection: null,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);
    expect(screen.queryByText(/Spin:/i)).not.toBeInTheDocument();
  });

  it("shows a muted empty state when there are no pitches", () => {
    const situation = { ...mlbLiveDetail.situation!, pitches: [] };
    render(<MlbPitchZone situation={situation} />);
    expect(screen.getByText(/No pitches yet/i)).toBeInTheDocument();
  });

  it("plots a pitch at the exact center of the zone (zoneX: 0, zoneY: 0) near the strike-box center", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          zoneX: 0,
          zoneY: 0,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);

    const marker = screen
      .getByTestId("mlb-pitch-zone-svg")
      .querySelector('[data-testid="mlb-pitch-marker"]');
    expect(marker).not.toBeNull();

    const cx = Number(marker!.getAttribute("cx"));
    const cy = Number(marker!.getAttribute("cy"));
    expect(cx).toBeCloseTo(ZONE_CENTER_X, 0);
    expect(cy).toBeCloseTo(ZONE_CENTER_Y, 0);
  });
});
