import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutContent } from "./AboutContent";

describe("AboutContent", () => {
  it("renders description and tech stack only", () => {
    render(<AboutContent />);

    expect(screen.getByText(/Alex Gonzalez/)).toBeInTheDocument();
    expect(
      screen.getByText(/Saint Mary.s College of California/),
    ).toBeInTheDocument();
    expect(screen.getByText(/statvista/i)).toBeInTheDocument();
    expect(screen.getByText(/research site/i)).toBeInTheDocument();
    expect(screen.getByText(/not gambling advice/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /tech stack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frontend: React, Tailwind")).toBeInTheDocument();
    expect(screen.getByText("Backend: FastAPI, Supabase")).toBeInTheDocument();
    expect(screen.queryByText(/vite/i)).not.toBeInTheDocument();

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
