import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../models/report";
import { buildAreaCharts } from "./dataAnalysisReport/charts/areaCharts";
import { buildAttributePieCharts } from "./dataAnalysisReport/charts/attributePieCharts";
import { buildDimensionCharts } from "./dataAnalysisReport/charts/dimensionCharts";
import { buildErrorFeatureObjectCharts } from "./dataAnalysisReport/charts/prevalenceCharts";
import { buildSurfaceShapeCharts } from "./dataAnalysisReport/charts/shapeOverlayCharts";
import { buildVanityAttributesCharts } from "./dataAnalysisReport/charts/vanityAttributesCharts";
import { buildWallEmbeddedPieCharts } from "./dataAnalysisReport/charts/wallEmbeddedPieCharts";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";
import { CaptureCharts } from "./dataAnalysisReport/types";
import { getLineChartConfig } from "../utils/chart/configBuilders";

function buildAreaKdeChart(metadataList: ArtifactAnalysis[]): ChartConfiguration {
  const layout = computeLayoutConstants();
  const noResults = 0;

  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > noResults);
  const areaInitialMin = 0;
  const areaInitialMax = 150;
  const areaKdeResolution = 200;
  const { kde: areaKde } = buildDynamicKde(areaVals, areaInitialMin, areaInitialMax, areaKdeResolution);

  return getLineChartConfig(
    areaKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: areaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "area",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );
}

function buildScanCharts(metadataList: ArtifactAnalysis[], artifactDirs?: string[]): Partial<CaptureCharts> {
  const layout = computeLayoutConstants();
  const charts: Partial<CaptureCharts> = {};

  charts.area = buildAreaKdeChart(metadataList);

  Object.assign(charts, buildErrorFeatureObjectCharts(metadataList, artifactDirs, layout));

  if (artifactDirs !== undefined) {
    Object.assign(charts, buildDimensionCharts(artifactDirs, layout));
    Object.assign(charts, buildAreaCharts(artifactDirs, layout));
    Object.assign(charts, buildAttributePieCharts(artifactDirs, layout));
    Object.assign(charts, buildWallEmbeddedPieCharts(artifactDirs, layout));
    Object.assign(charts, buildVanityAttributesCharts(artifactDirs, layout));
    Object.assign(charts, buildSurfaceShapeCharts(artifactDirs, layout));
  }

  return charts;
}

function buildScanReportSections(
  charts: Partial<CaptureCharts>,
  artifactDirs: string[] | undefined,
  videoCount: number
): ReportData {
  const initialCount = 0;
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];

  // Summary Analysis Subsection
  sections.push({
    data: "",
    level: 3,
    title: "Summary Analysis",
    type: "header"
  });

  if (charts.sections !== undefined) {
    sections.push({
      data: charts.sections,
      title: "Section Types",
      type: "chart"
    });
  }

  if (charts.features !== undefined) {
    sections.push({
      data: charts.features,
      title: "Feature Prevalence",
      type: "chart"
    });
  }

  if (charts.errors !== undefined) {
    sections.push({
      data: charts.errors,
      title: "Capture Errors",
      type: "chart"
    });
  }

  // Object Analysis Subsection
  sections.push({
    data: "",
    level: 3,
    title: "Object Analysis",
    type: "header"
  });

  if (charts.objects !== undefined) {
    sections.push({
      data: charts.objects,
      title: "Object Distribution",
      type: "chart"
    });
  }

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
      if (Object.prototype.hasOwnProperty.call(charts, chartKey)) {
        const chartData = charts[chartKey];
        if (chartData !== undefined) {
          availableCharts.push({ data: chartData, title });
        }
      }
    }

    if (availableCharts.length > initialCount) {
      const chartsPerRow = 3;
      for (let i = initialCount; i < availableCharts.length; i += chartsPerRow) {
        const rowCharts = availableCharts.slice(i, i + chartsPerRow);
        sections.push({
          data: rowCharts,
          type: "chart-row"
        });
      }
    }
  }

  if (artifactDirs !== undefined) {
    const vanityAttributeCharts: { data: ChartConfiguration; title: string }[] = [];
    if (charts.sinkCount !== undefined) {
      vanityAttributeCharts.push({ data: charts.sinkCount, title: "Number of Sinks" });
    }
    if (charts.vanityType !== undefined) {
      vanityAttributeCharts.push({ data: charts.vanityType, title: "Vanity Type" });
    }

    if (vanityAttributeCharts.length > initialCount) {
      sections.push({
        data: vanityAttributeCharts,
        type: "chart-row"
      });
    }
  }

  if (artifactDirs !== undefined && charts.tubLength !== undefined) {
    sections.push({
      data: charts.tubLength,
      title: "Tub Length Distribution",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined && charts.vanityLength !== undefined) {
    sections.push({
      data: charts.vanityLength,
      title: "Vanity Length Distribution",
      type: "chart"
    });
  }

  // Floor Analysis Subsection
  sections.push({
    data: "",
    level: 3,
    title: "Floor Analysis",
    type: "header"
  });

  if (charts.area !== undefined) {
    sections.push({
      data: charts.area,
      title: "Floor Area",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    if (charts.floorLength !== undefined) {
      sections.push({
        data: charts.floorLength,
        title: "Floor Lengths",
        type: "chart"
      });
    }

    if (charts.floorWidth !== undefined) {
      sections.push({
        data: charts.floorWidth,
        title: "Floor Widths",
        type: "chart"
      });
    }

    if (charts.floorAspectRatio !== undefined || charts.floorShapes !== undefined) {
      if (charts.floorAspectRatio !== undefined && charts.floorShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.floorAspectRatio, title: "Floor Aspect Ratio" },
            { data: charts.floorShapes, title: "Floor Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.floorAspectRatio !== undefined) {
        sections.push({
          data: charts.floorAspectRatio,
          title: "Floor Aspect Ratio",
          type: "chart"
        });
      } else if (charts.floorShapes !== undefined) {
        sections.push({
          data: charts.floorShapes,
          title: "Floor Shapes",
          type: "chart"
        });
      }
    }
  }

  // Wall Analysis Subsection
  if (artifactDirs !== undefined) {
    sections.push({
      data: "",
      level: 3,
      title: "Wall Analysis",
      type: "header"
    });

    if (charts.wallHeight !== undefined) {
      sections.push({
        data: charts.wallHeight,
        title: "Wall Heights",
        type: "chart"
      });
    }

    if (charts.wallWidth !== undefined) {
      sections.push({
        data: charts.wallWidth,
        title: "Wall Widths",
        type: "chart"
      });
    }

    if (charts.wallArea !== undefined) {
      sections.push({
        data: charts.wallArea,
        title: "Wall Areas",
        type: "chart"
      });
    }

    if (charts.wallAspectRatio !== undefined || charts.wallShapes !== undefined) {
      if (charts.wallAspectRatio !== undefined && charts.wallShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.wallAspectRatio, title: "Wall Aspect Ratio" },
            { data: charts.wallShapes, title: "Wall Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.wallAspectRatio !== undefined) {
        sections.push({
          data: charts.wallAspectRatio,
          title: "Wall Aspect Ratio",
          type: "chart"
        });
      } else if (charts.wallShapes !== undefined) {
        sections.push({
          data: charts.wallShapes,
          title: "Wall Shapes",
          type: "chart"
        });
      }
    }

    const embeddedCharts: { data: ChartConfiguration; title: string }[] = [];
    if (charts.wallsWithWindows !== undefined) {
      embeddedCharts.push({ data: charts.wallsWithWindows, title: "Walls with Windows" });
    }
    if (charts.wallsWithDoors !== undefined) {
      embeddedCharts.push({ data: charts.wallsWithDoors, title: "Walls with Doors" });
    }
    if (charts.wallsWithOpenings !== undefined) {
      embeddedCharts.push({ data: charts.wallsWithOpenings, title: "Walls with Openings" });
    }

    if (embeddedCharts.length > initialCount) {
      sections.push({
        data: embeddedCharts,
        type: "chart-row"
      });
    }
  }

  // Window Analysis Subsection
  if (artifactDirs !== undefined) {
    sections.push({
      data: "",
      level: 3,
      title: "Window Analysis",
      type: "header"
    });

    if (charts.windowHeight !== undefined) {
      sections.push({
        data: charts.windowHeight,
        title: "Window Heights",
        type: "chart"
      });
    }

    if (charts.windowWidth !== undefined) {
      sections.push({
        data: charts.windowWidth,
        title: "Window Widths",
        type: "chart"
      });
    }

    if (charts.windowArea !== undefined) {
      sections.push({
        data: charts.windowArea,
        title: "Window Areas",
        type: "chart"
      });
    }

    if (charts.windowAspectRatio !== undefined || charts.windowShapes !== undefined) {
      if (charts.windowAspectRatio !== undefined && charts.windowShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.windowAspectRatio, title: "Window Aspect Ratio" },
            { data: charts.windowShapes, title: "Window Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.windowAspectRatio !== undefined) {
        sections.push({
          data: charts.windowAspectRatio,
          title: "Window Aspect Ratio",
          type: "chart"
        });
      } else if (charts.windowShapes !== undefined) {
        sections.push({
          data: charts.windowShapes,
          title: "Window Shapes",
          type: "chart"
        });
      }
    }
  }

  // Door Analysis Subsection
  if (artifactDirs !== undefined) {
    sections.push({
      data: "",
      level: 3,
      title: "Door Analysis",
      type: "header"
    });

    if (charts.doorHeight !== undefined) {
      sections.push({
        data: charts.doorHeight,
        title: "Door Heights",
        type: "chart"
      });
    }

    if (charts.doorWidth !== undefined) {
      sections.push({
        data: charts.doorWidth,
        title: "Door Widths",
        type: "chart"
      });
    }

    if (charts.doorArea !== undefined) {
      sections.push({
        data: charts.doorArea,
        title: "Door Areas",
        type: "chart"
      });
    }

    if (charts.doorAspectRatio !== undefined || charts.doorShapes !== undefined) {
      if (charts.doorAspectRatio !== undefined && charts.doorShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.doorAspectRatio, title: "Door Aspect Ratio" },
            { data: charts.doorShapes, title: "Door Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.doorAspectRatio !== undefined) {
        sections.push({
          data: charts.doorAspectRatio,
          title: "Door Aspect Ratio",
          type: "chart"
        });
      } else if (charts.doorShapes !== undefined) {
        sections.push({
          data: charts.doorShapes,
          title: "Door Shapes",
          type: "chart"
        });
      }
    }
  }

  // Opening Analysis Subsection
  if (artifactDirs !== undefined) {
    sections.push({
      data: "",
      level: 3,
      title: "Opening Analysis",
      type: "header"
    });

    if (charts.openingHeight !== undefined) {
      sections.push({
        data: charts.openingHeight,
        title: "Opening Heights",
        type: "chart"
      });
    }

    if (charts.openingWidth !== undefined) {
      sections.push({
        data: charts.openingWidth,
        title: "Opening Widths",
        type: "chart"
      });
    }

    if (charts.openingArea !== undefined) {
      sections.push({
        data: charts.openingArea,
        title: "Opening Areas",
        type: "chart"
      });
    }

    if (charts.openingAspectRatio !== undefined || charts.openingShapes !== undefined) {
      if (charts.openingAspectRatio !== undefined && charts.openingShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.openingAspectRatio, title: "Opening Aspect Ratio" },
            { data: charts.openingShapes, title: "Opening Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.openingAspectRatio !== undefined) {
        sections.push({
          data: charts.openingAspectRatio,
          title: "Opening Aspect Ratio",
          type: "chart"
        });
      } else if (charts.openingShapes !== undefined) {
        sections.push({
          data: charts.openingShapes,
          title: "Opening Shapes",
          type: "chart"
        });
      }
    }
  }

  return {
    sections,
    subtitle,
    title: "Scan Data Analysis"
  };
}

export function buildScanAnalysisReport(
  metadataList: ArtifactAnalysis[],
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const charts = buildScanCharts(metadataList, artifactDirs);
  return buildScanReportSections(charts, artifactDirs, videoCount);
}
