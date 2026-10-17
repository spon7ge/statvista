import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactForm } from "./ContactForm";

describe("ContactForm", () => {
  it("renders name, subject, description and a disabled send with coming soon", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^subject$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: /^send$/i });
    expect(send).toBeDisabled();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByTestId("contact-form").className).toMatch(
      /contact-content/,
    );
  });
});
