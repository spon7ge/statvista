import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MlbPitchZone,
  ZONE_CENTER_X,
  ZONE_CENTER_Y,
  ZONE_SCALE,
} from "./MlbPitchZone";
import { mlbLiveDetail } from "../lib/testFixtures";

function markerPoint(index = 0): { cx: number; cy: number } {
  const markers = screen
    .getByTestId("mlb-pitch-zone-svg")
    .querySelectorAll('[data-testid="mlb-pitch-marker"]');
  const marker = markers[index];
  expect(marker).toBeTruthy();
  return {
    cx: Number(marker!.getAttribute("cx")),
    cy: Number(marker!.getAttribute("cy")),
  };
}

function isInsideStrikeBox(cx: number, cy: number): boolean {
  return (
    Math.abs(cx - ZONE_CENTER_X) <= ZONE_SCALE &&
    Math.abs(cy - ZONE_CENTER_Y) <= ZONE_SCALE
  );
}

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
      screen.queryByTestId("mlb-pitch-zone-batter-silhouette"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-pitch-zone-svg")).toBeInTheDocument();
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

  it("plots a strike at the exact center of the zone (zoneX: 0, zoneY: 0)", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          isStrike: true,
          result: "Called Strike",
          zoneX: 0,
          zoneY: 0,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);

    const { cx, cy } = markerPoint();
    expect(cx).toBeCloseTo(ZONE_CENTER_X, 0);
    expect(cy).toBeCloseTo(ZONE_CENTER_Y, 0);
    expect(isInsideStrikeBox(cx, cy)).toBe(true);
  });

  it("keeps called balls outside the strike box even when coords are inside", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          isStrike: false,
          result: "Ball",
          zoneX: 0.1,
          zoneY: 0.2,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);

    const { cx, cy } = markerPoint();
    expect(isInsideStrikeBox(cx, cy)).toBe(false);
  });

  it("plots zoneX/zoneY = 1 on the strike-box edge for strikes", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          isStrike: true,
          result: "Called Strike",
          zoneX: 1,
          zoneY: 0,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);

    const { cx, cy } = markerPoint();
    expect(cx).toBeCloseTo(ZONE_CENTER_X + ZONE_SCALE, 0);
    expect(cy).toBeCloseTo(ZONE_CENTER_Y, 0);
  });
});
