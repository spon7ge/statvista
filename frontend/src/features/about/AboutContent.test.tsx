import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AboutContent } from "./AboutContent";

describe("AboutContent", () => {
  it("renders product intro, sections, and data source links", () => {
    render(<AboutContent />);
    expect(screen.getByText(/statvista/i)).toBeInTheDocument();
    const whatHeading = screen.getByRole("heading", { name: /what you can do/i });
    expect(whatHeading.closest(".about-content")).toBeTruthy();
    const whatSection = whatHeading.closest("section")!;
    expect(whatSection).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tech stack/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /data sources/i }),
    ).toBeInTheDocument();
    expect(within(whatSection).getByText(/^Props$/)).toBeInTheDocument();
    expect(within(whatSection).getByText(/^Games$/)).toBeInTheDocument();
    expect(within(whatSection).queryByText(/^Legs$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/arbitrage/i)).not.toBeInTheDocument();
    expect(screen.getByText(/react 19/i)).toBeInTheDocument();
    const espn = screen.getByRole("link", { name: /espn/i });
    expect(espn).toHaveAttribute("href", "https://www.espn.com/");
    expect(espn).toHaveAttribute("target", "_blank");
    expect(espn).toHaveAttribute("rel", "noopener noreferrer");
    expect(espn.className).toMatch(/text-c4/);
    expect(screen.getByRole("link", { name: /mlb stats api/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rotowire/i })).toBeInTheDocument();
    expect(screen.getByText(/parlayapi \/ sharp/i)).toBeInTheDocument();
    expect(screen.getByText(/supabase \(postgres\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /parlayapi \/ sharp/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /supabase \(postgres\)/i }),
    ).not.toBeInTheDocument();
  });
});
