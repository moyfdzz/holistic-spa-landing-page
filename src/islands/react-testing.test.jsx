import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * Small component used only to prove the React testing pipeline works
 * (JSX transform, jsdom, Testing Library and jest-dom matchers).
 * Replace this file with tests for the real islands (language switcher,
 * contact form) when they exist.
 * @returns {import("react").JSX.Element} A button that counts its clicks.
 */
function ClickCounter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Clicks: {count}
    </button>
  );
}

describe("React testing pipeline", () => {
  it("renders a component and reacts to clicks", () => {
    render(<ClickCounter />);
    const button = screen.getByRole("button", { name: "Clicks: 0" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole("button")).toHaveTextContent("Clicks: 1");
  });
});
