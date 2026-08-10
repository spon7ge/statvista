import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { MlbStandingsGrid } from "./MlbStandingsGrid";

const sample: ApiMlbStandingsLeague[] = [
  {
    key: "al",
    label: "American League",
    divisions: [
      {
        key: "al-east",
        label: "AL East",
        teams: [
          {
            rank: 1,
            team_id: "147",
            abbrev: "NYY",
            name: "New York Yankees",
            logo_url: null,
            wins: 80,
            losses: 50,
            wl: "80-50",
            pct: ".615",
            gb: "-",
            l10: "7-3",
            streak: "W3",
          },
        ],
      },
    ],
  },
  {
    key: "nl",
    label: "National League",
    divisions: [
      {
        key: "nl-west",
        label: "NL West",
        teams: [
          {
            rank: 1,
            team_id: "119",
            abbrev: "LAD",
            name: "Los Angeles Dodgers",
            logo_url: null,
            wins: 75,
            losses: 55,
            wl: "75-55",
            pct: ".577",
            gb: "-",
            l10: "5-5",
            streak: "L2",
          },
        ],
      },
    ],
  },
];

describe("MlbStandingsGrid", () => {
  it("renders league sections, division titles, rows, and attribution", () => {
    render(<MlbStandingsGrid leagues={sample} view="division" />);

    expect(
      screen.getByRole("heading", { name: "American League" }),
    ).toHaveClass("text-[18px]");
    expect(
      screen.getByRole("heading", { name: "National League" }),
    ).toHaveClass("text-[18px]");
    expect(screen.getByText("AL East")).toBeInTheDocument();
    expect(screen.getByText("NL West")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("80-50")).toBeInTheDocument();
    expect(screen.getByText(".615")).toBeInTheDocument();
    expect(screen.getByText("7-3")).toBeInTheDocument();
    expect(screen.getByText("W3")).toBeInTheDocument();
    expect(screen.getByText("LAD")).toBeInTheDocument();
    expect(screen.getByText("75-55")).toBeInTheDocument();
    expect(screen.getByText("5-5")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toHaveClass(
      "text-[14px]",
    );
    expect(screen.getAllByRole("columnheader", { name: "W-L" }).length).toBe(2);
    expect(screen.getAllByRole("columnheader", { name: "PCT" }).length).toBe(2);
    expect(screen.getAllByRole("columnheader", { name: "GB" }).length).toBe(2);
    expect(screen.getAllByRole("columnheader", { name: "L10" }).length).toBe(2);
    expect(screen.getAllByRole("columnheader", { name: "Strk" }).length).toBe(2);
  });

  it("shows loading skeletons under AL and NL section titles", () => {
    render(<MlbStandingsGrid leagues={[]} view="division" isLoading />);

    expect(screen.getByRole("heading", { name: "American League" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "National League" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Loading standings")).toHaveLength(2);
    expect(screen.getAllByTestId("standings-skeleton")).toHaveLength(6);
  });

  it("shows error copy when standings have never loaded", () => {
    render(<MlbStandingsGrid leagues={[]} view="division" isError />);

    expect(screen.getByText("Standings unavailable")).toBeInTheDocument();
  });

  it("shows empty-state copy when leagues are empty", () => {
    render(<MlbStandingsGrid leagues={[]} view="division" />);

    expect(
      screen.getByText("Standings not yet available for this season"),
    ).toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toBeInTheDocument();
  });

  it("shows No data for empty division", () => {
    render(
      <MlbStandingsGrid
        leagues={[
          {
            key: "al",
            label: "American League",
            divisions: [{ key: "al-east", label: "AL East", teams: [] }],
          },
        ]}
        view="division"
      />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders conference league tables when view is conference", () => {
    render(<MlbStandingsGrid leagues={sample} view="conference" />);

    expect(screen.getByText("American League")).toBeInTheDocument();
    expect(screen.getByText("National League")).toBeInTheDocument();
    expect(screen.queryByText("AL East")).not.toBeInTheDocument();
    expect(screen.queryByText("NL West")).not.toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("LAD")).toBeInTheDocument();
  });
});
