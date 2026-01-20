import * as fs from "fs";
import * as path from "path";
import React from "react";

import { ReportSection } from "../../../models/report";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

function loadLaplacianImageBase64(fileName: string): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "laplacian", fileName);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Prefix = "data:image/png;base64,";
  return `${base64Prefix}${imageBuffer.toString("base64")}`;
}

export function buildLaplacianExamplesSection(): ReportSection {
  const layout = computeLayoutConstants();
  const examples = [
    { fileName: "0.4.png", label: "0.4" },
    { fileName: "2.png", label: "2" },
    { fileName: "3.png", label: "3" },
    { fileName: "844.png", label: "844" }
  ];
  const gapPixels = 12;
  const minColumnWidth = 140;
  const columnCount = examples.length.toString();
  const gridTemplateColumns = `repeat(${columnCount}, minmax(${minColumnWidth.toString()}px, 1fr))`;
  const imageHeight = 180;
  const cardStyle = {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  } as const;

  const Component = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gap: `${gapPixels.toString()}px`,
          gridTemplateColumns,
          margin: "0 auto",
          maxWidth: `${layout.PAGE_CONTENT_WIDTH.toString()}px`,
          width: "100%"
        }
      },
      ...examples.map((example) =>
        React.createElement(
          "div",
          { key: example.label, style: cardStyle },
          React.createElement("img", {
            alt: `Laplacian example ${example.label}`,
            src: loadLaplacianImageBase64(example.fileName),
            style: {
              height: `${imageHeight.toString()}px`,
              maxWidth: "100%",
              objectFit: "contain",
              width: "100%"
            }
          }),
          React.createElement(
            "div",
            {
              style: {
                color: "#374151",
                fontSize: "12px",
                fontWeight: 600,
                textAlign: "center"
              }
            },
            `Laplacian ${example.label}`
          )
        )
      )
    );

  return {
    component: Component,
    level: 3,
    title: "Laplacian examples",
    type: "react-component"
  };
}
