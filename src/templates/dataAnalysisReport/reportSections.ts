import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../../models/report";
import { CaptureCharts } from "./types";

export function buildReportSections(
  charts: CaptureCharts,
  artifactDirs: string[] | undefined,
  _avgDuration: number,
  videoCount: number
): ReportData {
  const sections: ReportSection[] = [];
  const INITIAL_COUNT = 0;
  const subtitle = `Artifacts: ${videoCount.toString()}`;

  const chartSections: ReportSection[] = [];

  // Video Analysis Section (H2)
  chartSections.push({
    data: "",
    level: 2,
    title: "Video Analysis",
    type: "header"
  });

  chartSections.push({
    data: charts.duration,
    title: "Duration",
    type: "chart"
  });

  chartSections.push({
    data: [
      {
        data: charts.fps,
        title: "Framerate"
      },
      {
        data: charts.resolution,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  chartSections.push({
    data: "",
    title: "",
    type: "page-break"
  });

  // AR Data Analysis Section (H2)
  chartSections.push({
    data: "",
    level: 2,
    title: "AR Data Analysis",
    type: "header"
  });

  chartSections.push({
    data: charts.deviceModel,
    title: "Device Model",
    type: "chart"
  });

  chartSections.push({
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

  chartSections.push({
    data: charts.ambient,
    title: "Ambient Intensity",
    type: "chart"
  });

  chartSections.push({
    data: charts.temperature,
    title: "Color Temperature",
    type: "chart"
  });

  chartSections.push({
    data: charts.iso,
    title: "ISO Speed",
    type: "chart"
  });

  chartSections.push({
    data: charts.brightness,
    title: "Brightness Value",
    type: "chart"
  });

  // Scan Data Analysis Section (H2)
  chartSections.push({
    data: "",
    level: 2,
    title: "Scan Data Analysis",
    type: "header"
  });

  // Summary Analysis Subsection (H3)
  chartSections.push({
    data: "",
    level: 3,
    title: "Summary Analysis",
    type: "header"
  });

  chartSections.push({
    data: charts.sections,
    title: "Section Types",
    type: "chart"
  });

  chartSections.push({
    data: charts.features,
    title: "Feature Prevalence",
    type: "chart"
  });

  chartSections.push({
    data: charts.errors,
    title: "Capture Errors",
    type: "chart"
  });

  // Object Analysis Subsection (H3)
  chartSections.push({
    data: "",
    level: 3,
    title: "Object Analysis",
    type: "header"
  });

  chartSections.push({
    data: charts.objects,
    title: "Object Distribution",
    type: "chart"
  });

  if (artifactDirs !== undefined) {
    const attributeChartMap: { chartKey: keyof CaptureCharts; title: string }[] = [
      { chartKey: "doorIsOpen", title: "Door Open/Closed" },
      { chartKey: "chairArmType", title: "Chair Arm Type" },
      { chartKey: "chairBackType", title: "Chair Back Type" },
      { chartKey: "chairLegType", title: "Chair Base Type" },
      { chartKey: "chairType", title: "Chair Type" },
      { chartKey: "sofaType", title: "Sofa Type" },
      { chartKey: "storageType", title: "Storage Type" },
      { chartKey: "tableShapeType", title: "Table Shape Type" },
      { chartKey: "tableType", title: "Table Type" }
    ];

    const availableCharts: { data: ChartConfiguration; title: string }[] = [];
    for (const { chartKey, title } of attributeChartMap) {
      // TypeScript knows chartKey is valid, but runtime may have undefined values
      // Use Object.hasOwnProperty to check existence in a type-safe way
      if (Object.prototype.hasOwnProperty.call(charts, chartKey)) {
        availableCharts.push({ data: charts[chartKey], title });
      }
    }

    if (availableCharts.length > INITIAL_COUNT) {
      const chartsPerRow = 3;
      for (let i = INITIAL_COUNT; i < availableCharts.length; i += chartsPerRow) {
        const rowCharts = availableCharts.slice(i, i + chartsPerRow);
        chartSections.push({
          data: rowCharts,
          type: "chart-row"
        });
      }
    }
  }

  if (artifactDirs !== undefined) {
    const vanityAttributeCharts: { data: ChartConfiguration; title: string }[] = [];
    if (Object.prototype.hasOwnProperty.call(charts, "sinkCount")) {
      vanityAttributeCharts.push({ data: charts.sinkCount, title: "Number of Sinks" });
    }
    if (Object.prototype.hasOwnProperty.call(charts, "vanityType")) {
      vanityAttributeCharts.push({ data: charts.vanityType, title: "Vanity Type" });
    }

    if (vanityAttributeCharts.length > INITIAL_COUNT) {
      chartSections.push({
        data: vanityAttributeCharts,
        type: "chart-row"
      });
    }
  }

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.tubLength,
      title: "Tub Length Distribution",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.vanityLength,
      title: "Vanity Length Distribution",
      type: "chart"
    });
  }

  // Floor Analysis Subsection (H3)
  chartSections.push({
    data: "",
    level: 3,
    title: "Floor Analysis",
    type: "header"
  });

  chartSections.push({
    data: charts.area,
    title: "Floor Area",
    type: "chart"
  });

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.floorLength,
      title: "Floor Lengths",
      type: "chart"
    });

    chartSections.push({
      data: charts.floorWidth,
      title: "Floor Widths",
      type: "chart"
    });

    chartSections.push({
      data: charts.floorAspectRatio,
      title: "Floor Aspect Ratio",
      type: "chart"
    });
  }

  // Wall Analysis Subsection (H3)
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: "",
      level: 3,
      title: "Wall Analysis",
      type: "header"
    });

    chartSections.push({
      data: charts.wallHeight,
      title: "Wall Heights",
      type: "chart"
    });

    chartSections.push({
      data: charts.wallWidth,
      title: "Wall Widths",
      type: "chart"
    });

    chartSections.push({
      data: charts.wallArea,
      title: "Wall Areas",
      type: "chart"
    });

    chartSections.push({
      data: charts.wallAspectRatio,
      title: "Wall Aspect Ratio",
      type: "chart"
    });

    const embeddedCharts: { data: ChartConfiguration; title: string }[] = [];
    embeddedCharts.push({ data: charts.wallsWithWindows, title: "Walls with Windows" });
    embeddedCharts.push({ data: charts.wallsWithDoors, title: "Walls with Doors" });
    embeddedCharts.push({ data: charts.wallsWithOpenings, title: "Walls with Openings" });

    if (embeddedCharts.length > INITIAL_COUNT) {
      chartSections.push({
        data: embeddedCharts,
        type: "chart-row"
      });
    }
  }

  // Window Analysis Subsection (H3)
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: "",
      level: 3,
      title: "Window Analysis",
      type: "header"
    });

    chartSections.push({
      data: charts.windowHeight,
      title: "Window Heights",
      type: "chart"
    });

    chartSections.push({
      data: charts.windowWidth,
      title: "Window Widths",
      type: "chart"
    });

    chartSections.push({
      data: charts.windowArea,
      title: "Window Areas",
      type: "chart"
    });

    chartSections.push({
      data: charts.windowAspectRatio,
      title: "Window Aspect Ratio",
      type: "chart"
    });
  }

  // Door Analysis Subsection (H3)
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: "",
      level: 3,
      title: "Door Analysis",
      type: "header"
    });

    chartSections.push({
      data: charts.doorHeight,
      title: "Door Heights",
      type: "chart"
    });

    chartSections.push({
      data: charts.doorWidth,
      title: "Door Widths",
      type: "chart"
    });

    chartSections.push({
      data: charts.doorArea,
      title: "Door Areas",
      type: "chart"
    });

    chartSections.push({
      data: charts.doorAspectRatio,
      title: "Door Aspect Ratio",
      type: "chart"
    });
  }

  // Opening Analysis Subsection (H3)
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: "",
      level: 3,
      title: "Opening Analysis",
      type: "header"
    });

    chartSections.push({
      data: charts.openingHeight,
      title: "Opening Heights",
      type: "chart"
    });

    chartSections.push({
      data: charts.openingWidth,
      title: "Opening Widths",
      type: "chart"
    });

    chartSections.push({
      data: charts.openingArea,
      title: "Opening Areas",
      type: "chart"
    });

    chartSections.push({
      data: charts.openingAspectRatio,
      title: "Opening Aspect Ratio",
      type: "chart"
    });
  }

  const reportData: ReportData = {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
  return reportData;
}
