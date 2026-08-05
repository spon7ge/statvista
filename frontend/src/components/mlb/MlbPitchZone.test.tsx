import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbPitchZone } from "./MlbPitchZone";
import { mlbLiveDetail } from "./testFixtures";

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
});
