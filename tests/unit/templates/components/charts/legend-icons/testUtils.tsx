import React from "react";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react";

export function renderIconInSvg(iconElement: React.ReactElement, renderOptions?: RenderOptions): RenderResult {
  return render(<svg>{iconElement}</svg>, renderOptions);
}
