import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ApiMlbTeamPreviewResponse } from "@/shared/lib/api";
import { MlbTeamPreview } from "./MlbTeamPreview";

const fixture: ApiMlbTeamPreviewResponse = {
  side: "away",
  team: {
    id: "120",
    abbrev: "WSH",
    name: "Washington Nationals",
    logo_url: null,
  },
  batting_leaders: [
    {
      key: "hr",
      label: "HR",
      rank: 12,
      value: "28",
      player_id: "1",
      last_name: "Smith",
      headshot_url:
        "https://a.espncdn.com/i/headshots/mlb/players/full/1.png",
    },
    {
      key: "avg",
      label: "AVG",
      rank: 5,
      value: ".312",
      player_id: "2",
      last_name: "Abrams",
      headshot_url: null,
    },
    {
      key: "ops",
      label: "OPS",
      rank: null,
      value: ".950",
      player_id: "3",
      last_name: "Harper",
      headshot_url: null,
    },
  ],
  pitching_leaders: [
    {
      key: "era",
      label: "ERA",
      rank: 3,
      value: "2.41",
      player_id: "4",
      last_name: "Gray",
      headshot_url: null,
    },
    {
      key: "so",
      label: "SO",
      rank: 8,
      value: "142",
      player_id: "5",
      last_name: "Gore",
      headshot_url: null,
    },
    {
      key: "whip",
      label: "WHIP",
      rank: 2,
      value: "0.98",
      player_id: "4",
      last_name: "Gray",
      headshot_url: null,
    },
  ],
  batting_roster: [
    {
      player_id: "1",
      name: "C. Smith",
      g: 98,
      avg: ".278",
      obp: ".341",
      slg: ".512",
      ops: ".853",
      ab: 400,
      r: 60,
      h: 111,
      hr: 28,
      rbi: 74,
      bb: 40,
      so: 90,
      sb: 5,
    },
  ],
  pitching_roster: [
    {
      player_id: "4",
      name: "J. Gray",
      g: 22,
      gs: 22,
      w: 9,
      l: 4,
      sv: 0,
      ip: "130.1",
      h: 100,
      er: 35,
      bb: 30,
      so: 142,
      era: "2.41",
      whip: "0.98",
    },
  ],
};

describe("MlbTeamPreview", () => {
  it("renders batting and pitching leader titles and table headers", () => {
    render(<MlbTeamPreview data={fixture} isPending={false} error={null} />);

    expect(
      screen.getByRole("heading", { name: "Team Batting Leaders" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Team Pitching Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-batting-table")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-pitching-table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Batting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pitching" })).toBeInTheDocument();

    expect(screen.getByTestId("mlb-team-leader-card-hr")).toHaveStyle({
      backgroundColor: "#AB0003",
    });
    expect(screen.getByTestId("mlb-team-leader-card-era")).toHaveStyle({
      backgroundColor: "#AB0003",
    });

    const battingTable = screen.getByTestId("mlb-team-batting-table");
    expect(battingTable.className).toContain("overflow-x-auto");
    for (const col of [
      "G",
      "AVG",
      "OBP",
      "SLG",
      "OPS",
      "AB",
      "R",
      "H",
      "HR",
      "RBI",
      "BB",
      "SO",
      "SB",
    ]) {
      expect(battingTable).toHaveTextContent(col);
    }

    const pitchingTable = screen.getByTestId("mlb-team-pitching-table");
    for (const col of [
      "G",
      "GS",
      "W",
      "L",
      "SV",
      "IP",
      "H",
      "ER",
      "BB",
      "SO",
      "ERA",
      "WHIP",
    ]) {
      expect(pitchingTable).toHaveTextContent(col);
    }
  });

  it("uses two-column grid layout and root test id", () => {
    render(<MlbTeamPreview data={fixture} isPending={false} error={null} />);
    const root = screen.getByTestId("mlb-team-preview");
    expect(root.className).toMatch(/md:grid-cols-2/);
  });

  it("renders leader cards without team logos", () => {
    render(<MlbTeamPreview data={fixture} isPending={false} error={null} />);

    const hrCard = screen.getByTestId("mlb-team-leader-card-hr");
    expect(hrCard).toHaveTextContent("HR");
    expect(hrCard).toHaveTextContent("28");
    expect(hrCard).toHaveTextContent("Smith");
    expect(screen.getByTestId("mlb-team-leader-rank-hr")).toHaveTextContent(
      "#12",
    );
    expect(hrCard.querySelector('img[src*="team-logos"]')).toBeNull();
    expect(screen.getByTestId("mlb-team-leader-headshot-hr")).toHaveAttribute(
      "src",
      fixture.batting_leaders[0].headshot_url,
    );
  });

  it("uses initials fallback when headshot is null or fails", () => {
    render(<MlbTeamPreview data={fixture} isPending={false} error={null} />);

    expect(
      screen.getByTestId("mlb-team-leader-headshot-fallback-avg"),
    ).toHaveTextContent("A");

    fireEvent.error(screen.getByTestId("mlb-team-leader-headshot-hr"));
    expect(
      screen.getByTestId("mlb-team-leader-headshot-fallback-hr"),
    ).toHaveTextContent("S");
  });

  it("hides batting leaders section when empty", () => {
    render(
      <MlbTeamPreview
        data={{ ...fixture, batting_leaders: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Team Batting Leaders" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Team Pitching Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-batting-table")).toBeInTheDocument();
  });

  it("hides pitching leaders section when empty", () => {
    render(
      <MlbTeamPreview
        data={{ ...fixture, pitching_leaders: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Team Pitching Leaders" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Team Batting Leaders" }),
    ).toBeInTheDocument();
  });

  it("shows empty copy when batting roster empty", () => {
    render(
      <MlbTeamPreview
        data={{ ...fixture, batting_roster: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(screen.getByTestId("mlb-team-batting-table")).toHaveTextContent(
      "No season stats available",
    );
  });

  it("shows empty copy when pitching roster empty", () => {
    render(
      <MlbTeamPreview
        data={{ ...fixture, pitching_roster: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(screen.getByTestId("mlb-team-pitching-table")).toHaveTextContent(
      "No season stats available",
    );
  });

  it("shows loading when pending", () => {
    render(<MlbTeamPreview data={null} isPending={true} error={null} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-preview")).toBeInTheDocument();
  });

  it("shows error message when load fails", () => {
    render(
      <MlbTeamPreview
        data={null}
        isPending={false}
        error="Failed to load team preview"
      />,
    );
    expect(screen.getByText("Failed to load team preview")).toBeInTheDocument();
  });
});
