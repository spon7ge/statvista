import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiMlbFuturesMarket } from "@/shared/lib/api";
import { MlbFuturesBoard } from "./MlbFuturesBoard";

const sampleMarkets: ApiMlbFuturesMarket[] = [
  {
    id: "2761",
    name: "MLB  - World Series - Winner",
    display_name: "World Series Winner",
    provider: "DraftKings",
    entries: [
      {
        team_id: "10",
        abbrev: "NYY",
        name: "New York Yankees",
        logo_url: null,
        odds_american: "+450",
      },
    ],
  },
  {
    id: "2762",
    name: "MLB - American League Winner",
    display_name: "American League Winner",
    provider: "DraftKings",
    entries: [
      {
        team_id: "10",
        abbrev: "NYY",
        name: "New York Yankees",
        logo_url: null,
        odds_american: "+220",
      },
    ],
  },
  {
    id: "2763",
    name: "MLB - National League East Division Winner",
    display_name: "NL East Division Winner",
    provider: "DraftKings",
    entries: [
      {
        team_id: "19",
        abbrev: "NYM",
        name: "New York Mets",
        logo_url: null,
        odds_american: "+150",
      },
    ],
  },
];

describe("MlbFuturesBoard", () => {
  it("defaults World Series pill selected and shows matching markets", () => {
    render(
      <MlbFuturesBoard
        markets={sampleMarkets}
        group="world_series"
        onGroupChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "World Series" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("World Series Winner")).toBeInTheDocument();
    expect(screen.queryByText("American League Winner")).not.toBeInTheDocument();
    expect(screen.queryByText("NL East Division Winner")).not.toBeInTheDocument();
    expect(screen.getByText("New York Yankees")).toBeInTheDocument();
    expect(screen.getByText("+450")).toBeInTheDocument();
    expect(screen.getByText(/Odds by/)).toBeInTheDocument();
    expect(screen.getByText("DraftKings")).toBeInTheDocument();
    expect(screen.getByText("Data: ESPN")).toBeInTheDocument();
  });

  it("clicking Division shows only division markets", async () => {
    const user = userEvent.setup();
    const onGroupChange = vi.fn();

    render(
      <MlbFuturesBoard
        markets={sampleMarkets}
        group="world_series"
        onGroupChange={onGroupChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Division" }));
    expect(onGroupChange).toHaveBeenCalledWith("division");
  });

  it("shows division markets when group is division", () => {
    render(
      <MlbFuturesBoard
        markets={sampleMarkets}
        group="division"
        onGroupChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Division" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("NL East Division Winner")).toBeInTheDocument();
    expect(screen.queryByText("World Series Winner")).not.toBeInTheDocument();
    expect(screen.getByText("New York Mets")).toBeInTheDocument();
    expect(screen.getByText("+150")).toBeInTheDocument();
  });

  it("shows loading skeletons", () => {
    render(
      <MlbFuturesBoard
        markets={[]}
        group="world_series"
        onGroupChange={vi.fn()}
        isLoading
      />,
    );
    expect(screen.getByLabelText("Loading futures")).toBeInTheDocument();
  });

  it("shows error copy when never loaded", () => {
    render(
      <MlbFuturesBoard
        markets={[]}
        group="world_series"
        onGroupChange={vi.fn()}
        isError
      />,
    );
    expect(screen.getByText("Unable to load futures")).toBeInTheDocument();
  });

  it("shows empty copy when no markets", () => {
    render(
      <MlbFuturesBoard
        markets={[]}
        group="world_series"
        onGroupChange={vi.fn()}
      />,
    );
    expect(screen.getByText("No futures listed")).toBeInTheDocument();
    expect(screen.getByText("Data: ESPN")).toBeInTheDocument();
  });

  it("shows empty group copy when pill has no matching markets", () => {
    render(
      <MlbFuturesBoard
        markets={[sampleMarkets[0]!]}
        group="division"
        onGroupChange={vi.fn()}
      />,
    );
    expect(screen.getByText("No futures in this group")).toBeInTheDocument();
  });
});
