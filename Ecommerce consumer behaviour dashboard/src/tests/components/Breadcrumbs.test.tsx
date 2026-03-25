import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Breadcrumbs } from "../../components/common/Breadcrumbs";

// Mock the next-intl library
const mockT = jest.fn((key) => {
  // Provide a simple translation based on the key for testing purposes
  if (key === "firstPart") return "Home";
  return String(key ?? "");
});

jest.mock("next-intl", () => ({
  useTranslations: () => mockT,
}));

describe("Breadcrumbs Component", () => {
  // Reset mock calls before each test
  beforeEach(() => {
    mockT.mockClear();
  });

  // Test 1: Rendering with a pageName
  it("should render breadcrumbs with first part and translated page name", () => {
    // Arrange
    const page = "Dashboard";
    render(<Breadcrumbs pageName={page} />);

    // Act & Assert: Check the rendered output
    expect(screen.getByText(`Home > ${page}`)).toBeInTheDocument();

    // Assert: Check if the translation function was called with expected keys
    expect(mockT).toHaveBeenCalledWith("firstPart");
  });

  // Test 2: Rendering without a pageName
  it("should render breadcrumbs handling missing page name", () => {
    // Arrange: Render without the pageName prop
    render(<Breadcrumbs />);

    // Act & Assert: Check the rendered output based on how the mock handles undefined
    expect(screen.getByText(/^Home\s+>\s*$/)).toBeInTheDocument();

    // Assert: Check if the translation function was called with expected keys
    expect(mockT).toHaveBeenCalledWith("firstPart");
  });
});
