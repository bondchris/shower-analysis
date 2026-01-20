import React from "react";

import { ArtifactAnalysis } from "../../models/artifactAnalysis";
import { CoverageSphere } from "../../models/arData/coverageSphere";
import { ReportSection } from "../../models/report";
import { aggregateCoverageSpheres } from "../../utils/arData/coverage";
import { SphericalCoverageGlobe } from "../components/SphericalCoverageGlobe";
import { SphericalCoverageHeatmap } from "../components/SphericalCoverageHeatmap";

export function buildSphericalCoverageSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const emptyCount = 0;
  const hundredPercent = 100;
  const coverageSpheres: CoverageSphere[] = [];
  for (const artifact of metadataList) {
    if (
      artifact.coverageSphere !== undefined &&
      artifact.coverageSphere.rows > emptyCount &&
      artifact.coverageSphere.cols > emptyCount &&
      artifact.coverageSphere.grid.length > emptyCount
    ) {
      coverageSpheres.push(artifact.coverageSphere);
    }
  }

  const aggregation = aggregateCoverageSpheres(coverageSpheres);
  if (aggregation === null) {
    return null;
  }

  let coveragePercent = emptyCount;
  if (coverageSpheres.length > emptyCount) {
    const totalBins =
      coverageSpheres[emptyCount] !== undefined
        ? coverageSpheres[emptyCount].rows * coverageSpheres[emptyCount].cols
        : aggregation.totalBins;
    const coverageSum = coverageSpheres.reduce((sum, sphere) => {
      const nonZero = sphere.grid.reduce((rowTotal, row) => {
        if (!Array.isArray(row)) {
          return rowTotal;
        }
        return rowTotal + row.filter((value) => value > emptyCount).length;
      }, emptyCount);
      return sum + (totalBins > emptyCount ? nonZero / totalBins : emptyCount);
    }, emptyCount);
    coveragePercent = (coverageSum / coverageSpheres.length) * hundredPercent;
  }

  const CoverageComponent = (): React.ReactElement =>
    React.createElement(
      "div",
      { className: "flex flex-col gap-4" },
      React.createElement(SphericalCoverageGlobe, {
        coveragePercent,
        grid: aggregation.grid,
        maxSeconds: aggregation.maxBinSeconds,
        nonZeroBins: aggregation.nonZeroBins,
        totalSeconds: aggregation.totalSeconds
      }),
      React.createElement(SphericalCoverageHeatmap, {
        grid: aggregation.grid,
        maxSeconds: aggregation.maxBinSeconds
      })
    );

  return {
    component: CoverageComponent,
    title: "Spherical Coverage",
    type: "react-component"
  };
}
