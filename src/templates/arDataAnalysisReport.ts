import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ArDataCharts } from "../models/arDataCharts";
import { ReportData, ReportSection } from "../models/report";

import { buildDeviceCharts } from "./arDataAnalysisReport/chartBuilders/deviceCharts";
import { buildFramerateCharts } from "./arDataAnalysisReport/chartBuilders/framerateCharts";
import { buildLightingCharts } from "./arDataAnalysisReport/chartBuilders/lightingCharts";
import { buildMovementCharts } from "./arDataAnalysisReport/chartBuilders/movementCharts";
import { buildOrientationCharts } from "./arDataAnalysisReport/chartBuilders/orientationCharts";
import { buildTimingCharts } from "./arDataAnalysisReport/chartBuilders/timingCharts";
import {
  buildPhonePanSection,
  buildPhoneRollSection,
  buildPhoneTiltSection
} from "./arDataAnalysisReport/phoneOrientationSections";
import { buildSphericalCoverageSection } from "./arDataAnalysisReport/sphericalCoverageSection";
import {
  buildAvgDroppedFramePercentageOverTimeSection,
  buildDroppedFramesOverTimeSection
} from "./arDataAnalysisReport/timeSeriesSections";

function buildArDataCharts(metadataList: ArtifactAnalysis[]): ArDataCharts {
  const deviceCharts = buildDeviceCharts(metadataList);
  const timingCharts = buildTimingCharts(metadataList);
  const framerateCharts = buildFramerateCharts(metadataList);
  const movementCharts = buildMovementCharts(metadataList);
  const lightingCharts = buildLightingCharts(metadataList);
  const orientationCharts = buildOrientationCharts(metadataList);

  return {
    ambient: lightingCharts.ambient,
    aperture: deviceCharts.aperture,
    arDataFramerate: framerateCharts.arDataFramerate,
    brightness: lightingCharts.brightness,
    deviceModel: deviceCharts.deviceModel,
    droppedFrames: framerateCharts.droppedFrames,
    fastPanTiming: orientationCharts.fastPanTiming,
    fastPans: orientationCharts.fastPans,
    fastRollTiming: orientationCharts.fastRollTiming,
    fastRolls: orientationCharts.fastRolls,
    fastTiltTiming: orientationCharts.fastTiltTiming,
    fastTilts: orientationCharts.fastTilts,
    focalLength: deviceCharts.focalLength,
    fullRotation: orientationCharts.fullRotation,
    iso: lightingCharts.iso,
    maxAmbient: lightingCharts.maxAmbient,
    maxBrightness: lightingCharts.maxBrightness,
    maxIso: lightingCharts.maxIso,
    maxPanSpeed: orientationCharts.maxPanSpeed,
    maxRollSpeed: orientationCharts.maxRollSpeed,
    maxTemperature: lightingCharts.maxTemperature,
    maxTiltSpeed: orientationCharts.maxTiltSpeed,
    minAmbient: lightingCharts.minAmbient,
    minBrightness: lightingCharts.minBrightness,
    minIso: lightingCharts.minIso,
    minTemperature: lightingCharts.minTemperature,
    movementSpeed: movementCharts.movementSpeed,
    partialRotationCoverage: orientationCharts.partialRotationCoverage,
    scanEfficiency: movementCharts.scanEfficiency,
    temperature: lightingCharts.temperature,
    timeOfDay: timingCharts.timeOfDay,
    timezone: timingCharts.timezone
  };
}

function buildArDataReportSections(
  charts: ArDataCharts,
  videoCount: number,
  metadataList: ArtifactAnalysis[]
): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];

  sections.push({
    data: charts.deviceModel,
    title: "Device Model",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.focalLength,
        title: "Focal Length"
      },
      {
        data: charts.aperture,
        title: "Max Aperture"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.timezone,
    title: "Timezone (UTC Offset)",
    type: "chart"
  });

  sections.push({
    data: charts.timeOfDay,
    title: "Time of Day (Hour)",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.arDataFramerate,
        title: "AR Data Capture Rate"
      },
      {
        data: charts.droppedFrames,
        title: "Artifacts with Dropped Frames"
      }
    ],
    type: "chart-row"
  });

  const droppedFramesOverTime = buildDroppedFramesOverTimeSection(metadataList);
  if (droppedFramesOverTime !== null) {
    sections.push(droppedFramesOverTime);
  }

  const avgDroppedFramePercentageOverTime = buildAvgDroppedFramePercentageOverTimeSection(metadataList);
  if (avgDroppedFramePercentageOverTime !== null) {
    sections.push(avgDroppedFramePercentageOverTime);
  }

  sections.push({
    data: charts.scanEfficiency,
    title: "Scan Efficiency",
    type: "chart"
  });

  sections.push({
    title: "Movement Speed",
    type: "header"
  });

  sections.push({
    data: charts.movementSpeed,
    title: "Min / Avg / Max Speed Distribution",
    type: "chart"
  });

  const phoneTiltSection = buildPhoneTiltSection(metadataList);
  if (phoneTiltSection !== null) {
    sections.push(phoneTiltSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastTilts,
        title: "Scans with Fast Tilts (>5 °/s)"
      },
      {
        data: charts.maxTiltSpeed,
        title: "Maximum Tilt Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastTiltTiming,
    title: "Fast Tilt Timing During Scan",
    type: "chart"
  });

  const phoneRollSection = buildPhoneRollSection(metadataList);
  if (phoneRollSection !== null) {
    sections.push(phoneRollSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastRolls,
        title: "Scans with Fast Rolls (>5 °/s)"
      },
      {
        data: charts.maxRollSpeed,
        title: "Maximum Roll Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastRollTiming,
    title: "Fast Roll Timing During Scan",
    type: "chart"
  });

  const phonePanSection = buildPhonePanSection(metadataList);
  if (phonePanSection !== null) {
    sections.push(phonePanSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastPans,
        title: "Scans with Fast Pans (>5 °/s)"
      },
      {
        data: charts.maxPanSpeed,
        title: "Maximum Pan Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastPanTiming,
    title: "Fast Pan Timing During Scan",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.fullRotation,
        title: "Scans with Full 360° Rotation"
      },
      {
        data: charts.partialRotationCoverage,
        title: "Partial Rotation Coverage"
      }
    ],
    type: "chart-row"
  });

  const sphericalCoverageSection = buildSphericalCoverageSection(metadataList);
  if (sphericalCoverageSection !== null) {
    sections.push(sphericalCoverageSection);
  }

  sections.push({
    title: "Ambient Intensity",
    type: "header"
  });

  sections.push({
    data: charts.ambient,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minAmbient,
        title: "Minimum"
      },
      {
        data: charts.maxAmbient,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "Color Temperature",
    type: "header"
  });

  sections.push({
    data: charts.temperature,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minTemperature,
        title: "Minimum"
      },
      {
        data: charts.maxTemperature,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "ISO Speed",
    type: "header"
  });

  sections.push({
    data: charts.iso,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minIso,
        title: "Minimum"
      },
      {
        data: charts.maxIso,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "Brightness Value",
    type: "header"
  });

  sections.push({
    data: charts.brightness,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minBrightness,
        title: "Minimum"
      },
      {
        data: charts.maxBrightness,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  return {
    sections,
    subtitle,
    title: "AR Data Analysis"
  };
}

export function buildArDataAnalysisReport(metadataList: ArtifactAnalysis[], videoCount: number): ReportData {
  const charts = buildArDataCharts(metadataList);
  return buildArDataReportSections(charts, videoCount, metadataList);
}
