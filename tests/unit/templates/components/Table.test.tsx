// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table } from "../../../../src/templates/components/Table";

describe("Table Component", () => {
  it("renders headers and data correctly", () => {
    const data = [
      ["Row 1 Col 1", "Row 1 Col 2"],
      ["Row 2 Col 1", "Row 2 Col 2"]
    ];
    const headers = ["Header 1", "Header 2"];

    render(<Table data={data} options={{ headers }} />);

    expect(screen.getByText("Header 1")).toBeInTheDocument();
    expect(screen.getByText("Row 1 Col 1")).toBeInTheDocument();
  });

  it("applies row classes correctly", () => {
    const data = [["Normal"], ["Highlighted"]];
    const rowClasses = { 1: "bg-red-500" };

    render(<Table data={data} options={{ rowClasses }} />);

    // Check for the class.
    // We assume the implementation applies it to the tr.
    // Since we don't know exact DOM structure, we can query by text then closest row
    const highlightedRow = screen.getByText("Highlighted").closest("tr");
    expect(highlightedRow).toHaveClass("bg-red-500");
  });
});
