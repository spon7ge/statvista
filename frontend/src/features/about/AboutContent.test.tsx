import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutContent } from "./AboutContent";

describe("AboutContent", () => {
  it("renders description and tech stack only", () => {
    render(<AboutContent />);

    expect(screen.getByText(/statvista/i)).toBeInTheDocument();
    expect(
      screen.getByText(/make pre-bet research easier/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/players, lines, and upcoming games/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /tech stack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/react 19/i)).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /what you can do/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /data sources/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/gamble responsibly/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /espn/i }),
    ).not.toBeInTheDocument();
  });
});
