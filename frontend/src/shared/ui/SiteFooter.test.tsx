import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("renders the rights reserved line only", () => {
    render(<SiteFooter />);
    expect(
      screen.queryByText(/informational and entertainment purposes only/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("© Copyright 2026 statvista. All Rights Reserved."),
    ).toBeInTheDocument();
  });
});
