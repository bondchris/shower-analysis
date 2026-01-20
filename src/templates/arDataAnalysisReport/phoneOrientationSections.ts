import * as fs from "fs";
import * as path from "path";
import React from "react";

import { ArtifactAnalysis } from "../../models/artifactAnalysis";
import { ProtractorChartConfig } from "../../models/chart/protractorChartConfig";
import { ReportSection } from "../../models/report";
import { ProtractorChart } from "../components/charts/ProtractorChart";
import { computeLayoutConstants } from "../dataAnalysisReport/layout";

function loadPhoneTiltImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "tilt.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function loadPhoneRollImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "roll.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function loadPhonePanImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "pan.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function createPhoneOrientationComponent(
  chartConfig: ProtractorChartConfig,
  imageDataUri: string,
  altText: string,
  chartHeight: number
): React.FC {
  const PhoneOrientationComponent: React.FC = () =>
    React.createElement(
      "div",
      {
        style: {
          alignItems: "center",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          width: "100%"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            alignItems: "center",
            display: "flex",
            flex: "1",
            justifyContent: "center"
          }
        },
        React.createElement("img", {
          alt: altText,
          src: imageDataUri,
          style: {
            maxHeight: `${String(chartHeight)}px`,
            maxWidth: "100%",
            objectFit: "contain"
          }
        })
      ),
      React.createElement(
        "div",
        {
          style: {
            flex: "2"
          }
        },
        React.createElement(ProtractorChart, { config: chartConfig })
      )
    );
  PhoneOrientationComponent.displayName = "PhoneOrientationComponent";
  return PhoneOrientationComponent;
}

export function buildPhoneTiltSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 180;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);
  let leftOverflowCount = noCount;
  let rightOverflowCount = noCount;

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phoneTiltHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phoneTiltHistogram.length && i < histogramSize; i++) {
      const count = artifact.phoneTiltHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
    leftOverflowCount += artifact.phoneTiltLeftOverflow;
    rightOverflowCount += artifact.phoneTiltRightOverflow;
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount,
    options: {
      chartId: "phoneTilt",
      lineColor: "#8b5cf6",
      title: "",
      width: chartWidth
    },
    rightOverflowCount,
    type: "protractor"
  };

  const imageDataUri = loadPhoneTiltImageBase64();
  const ChartComponent = createPhoneOrientationComponent(
    chartConfig,
    imageDataUri,
    "Phone tilt illustration",
    layout.HALF_CHART_HEIGHT
  );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Tilt Profile",
    type: "react-component"
  };
}

export function buildPhoneRollSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 180;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);
  let leftOverflowCount = noCount;
  let rightOverflowCount = noCount;

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phoneRollHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phoneRollHistogram.length && i < histogramSize; i++) {
      const count = artifact.phoneRollHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
    leftOverflowCount += artifact.phoneRollLeftOverflow;
    rightOverflowCount += artifact.phoneRollRightOverflow;
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount,
    options: {
      chartId: "phoneRoll",
      lineColor: "#3b82f6",
      title: "",
      width: chartWidth
    },
    rightOverflowCount,
    type: "protractor"
  };

  const imageDataUri = loadPhoneRollImageBase64();
  const ChartComponent = createPhoneOrientationComponent(
    chartConfig,
    imageDataUri,
    "Phone roll illustration",
    layout.HALF_CHART_HEIGHT
  );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Roll Profile",
    type: "react-component"
  };
}

export function buildPhonePanSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 360;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phonePanHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phonePanHistogram.length && i < histogramSize; i++) {
      const count = artifact.phonePanHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);
  const zeroAtTopAngleOffset = 90;

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount: noCount,
    options: {
      angleOffsetDegrees: zeroAtTopAngleOffset,
      chartId: "phonePan",
      fullCircle: true,
      lineColor: "#10b981",
      showAverage: false,
      title: "",
      width: chartWidth
    },
    rightOverflowCount: noCount,
    type: "protractor"
  };

  const imageDataUri = loadPhonePanImageBase64();
  const ChartComponent = createPhoneOrientationComponent(
    chartConfig,
    imageDataUri,
    "Phone pan illustration",
    layout.HALF_CHART_HEIGHT
  );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Pan Profile",
    type: "react-component"
  };
}
