import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbStandingsDivisionCard } from "./MlbStandingsDivisionCard";

describe("MlbStandingsDivisionCard", () => {
  it("renders section label and team abbrev", () => {
    render(
      <MlbStandingsDivisionCard
        section={{
          key: "al",
          label: "American League",
          teams: [
            {
              rank: 1,
              team_id: "147",
              abbrev: "NYY",
              name: "Yankees",
              logo_url: null,
              wins: 60,
              losses: 40,
              wl: "60-40",
              pct: ".600",
              gb: "-",
              l10: "6-4",
              streak: "W2",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "American League" }),
    ).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("60-40")).toBeInTheDocument();
  });
});
