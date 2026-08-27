import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueChatbotPanel } from "./LeagueChatbotPanel";

describe("LeagueChatbotPanel", () => {
  it("renders the MLB Chatbot coming-soon state", () => {
    render(<LeagueChatbotPanel league="mlb" />);
    expect(
      screen.getByRole("heading", { name: "MLB Chatbot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MLB Chatbot coming soon.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders the WNBA Chatbot coming-soon state", () => {
    render(<LeagueChatbotPanel league="wnba" />);
    expect(
      screen.getByRole("heading", { name: "WNBA Chatbot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("WNBA Chatbot coming soon.")).toBeInTheDocument();
  });
});
