import { getPieChartConfig } from "../../../utils/chart/configBuilders";
import { getDoorIsOpenCounts, getObjectAttributeCounts } from "../../../utils/data/rawScanExtractor";
import { startCase } from "lodash";
import {
  CabinetIcon,
  ChairArmExistingIcon,
  ChairArmMissingIcon,
  ChairBackMissingIcon,
  CircularEllipticIcon,
  DiningIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  ExistingIcon,
  FourIcon,
  RectangularIcon,
  ShelfIcon,
  SingleSeatIcon,
  StarIcon,
  StoolIcon,
  SwivelIcon,
  UnidentifiedIcon
} from "../../components/charts/legend-icons/iconConfig";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

export function buildAttributePieCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<
  Pick<
    CaptureCharts,
    | "doorIsOpen"
    | "chairArmType"
    | "chairBackType"
    | "chairLegType"
    | "chairType"
    | "sofaType"
    | "storageType"
    | "tableShapeType"
    | "tableType"
  >
> {
  const charts: Partial<
    Pick<
      CaptureCharts,
      | "doorIsOpen"
      | "chairArmType"
      | "chairBackType"
      | "chairLegType"
      | "chairType"
      | "sofaType"
      | "storageType"
      | "tableShapeType"
      | "tableType"
    >
  > = {};
  const INITIAL_COUNT = 0;
  const INCREMENT_STEP = 1;

  const distinctColors = [
    "#4E79A7", // Blue
    "#F28E2B", // Orange
    "#E15759", // Red
    "#76B7B2", // Cyan/Teal
    "#59A14F", // Green
    "#EDC948", // Yellow
    "#B07AA1", // Purple
    "#BAB0AC", // Gray
    "#FF9DA7", // Light Pink/Red
    "#9C755F" // Brown
  ];

  const labelChartCount = new Map<string, number>();

  const doorIsOpenCounts = getDoorIsOpenCounts(artifactDirs);
  Object.keys(doorIsOpenCounts).forEach((label) => {
    const currentCount = labelChartCount.get(label) ?? INITIAL_COUNT;
    labelChartCount.set(label, currentCount + INCREMENT_STEP);
  });

  const attributeTypeMap = {
    ChairArmType: "chairArmType",
    ChairBackType: "chairBackType",
    ChairLegType: "chairLegType",
    ChairType: "chairType",
    SofaType: "sofaType",
    StorageType: "storageType",
    TableShapeType: "tableShapeType",
    TableType: "tableType"
  } as const;

  type AttributeChartKey = (typeof attributeTypeMap)[keyof typeof attributeTypeMap];

  for (const [attributeType] of Object.entries(attributeTypeMap)) {
    const attributeCounts = getObjectAttributeCounts(artifactDirs, attributeType);
    Object.keys(attributeCounts).forEach((label) => {
      const currentCount = labelChartCount.get(label) ?? INITIAL_COUNT;
      labelChartCount.set(label, currentCount + INCREMENT_STEP);
    });
  }

  const sharedLabels: string[] = [];
  const minChartsForShared = 2;
  for (const [label, count] of labelChartCount.entries()) {
    if (count >= minChartsForShared) {
      sharedLabels.push(label);
    }
  }

  sharedLabels.sort();

  const labelColorMap = new Map<string, string>();
  const firstColorIndex = 0;
  const defaultFallbackColor = distinctColors[firstColorIndex] ?? "#4E79A7";
  const decrement = 1;
  let sharedColorIndex = distinctColors.length - decrement;

  for (const label of sharedLabels) {
    if (sharedColorIndex >= firstColorIndex) {
      const color = distinctColors[sharedColorIndex];
      if (color !== undefined) {
        labelColorMap.set(label, color);
        sharedColorIndex -= decrement;
      }
    }
  }

  const getColorsForLabels = (labels: string[]): string[] => {
    let rotationIndex = firstColorIndex;
    const result: string[] = [];
    for (const label of labels) {
      const existingColor = labelColorMap.get(label);
      if (existingColor !== undefined) {
        result.push(existingColor);
        continue;
      }

      const colorIndex = rotationIndex % distinctColors.length;
      const color = distinctColors[colorIndex];
      rotationIndex++;
      if (color !== undefined) {
        result.push(color);
      } else {
        result.push(defaultFallbackColor);
      }
    }
    return result;
  };

  const doorIsOpenEntries = Object.entries(doorIsOpenCounts).sort(([, a], [, b]) => a - b);
  const doorIsOpenLabels = doorIsOpenEntries.map(([label]) => label);
  const doorIsOpenData = doorIsOpenEntries.map(([, value]) => value);

  if (doorIsOpenData.length > INITIAL_COUNT) {
    const doorColors = getColorsForLabels(doorIsOpenLabels);
    charts.doorIsOpen = getPieChartConfig(doorIsOpenLabels, doorIsOpenData, {
      colors: doorColors,
      height: layout.HALF_CHART_HEIGHT,
      legendIconComponents: {
        Closed: DoorClosedIcon,
        Open: DoorOpenIcon
      },
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    });
  }

  for (const [attributeType, chartKey] of Object.entries(attributeTypeMap)) {
    const attributeCounts = getObjectAttributeCounts(artifactDirs, attributeType);
    const attributeEntries = Object.entries(attributeCounts).sort(([, a], [, b]) => a - b);
    const originalLabels = attributeEntries.map(([label]) => label);
    const attributeData = attributeEntries.map(([, value]) => value);

    if (attributeData.length > INITIAL_COUNT) {
      const attributeLabels = originalLabels.map((label) => startCase(label));

      const circularEllipticLabel = "circularElliptic";
      const circularDisplayLabel = "Circular";
      const notFoundIndex = -1;
      const circularEllipticIndex = originalLabels.indexOf(circularEllipticLabel);
      if (circularEllipticIndex !== notFoundIndex) {
        attributeLabels[circularEllipticIndex] = circularDisplayLabel;
      }

      const labelMap = new Map<string, string>();
      originalLabels.forEach((original, index) => {
        labelMap.set(original, attributeLabels[index] ?? "");
      });

      const pieChartOptions: {
        colors: string[];
        height: number;
        legendIconComponents?: Record<
          string,
          React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
        >;
        shrinkToLegend: boolean;
        title: string;
        width: number;
      } = {
        colors: getColorsForLabels(originalLabels),
        height: layout.HALF_CHART_HEIGHT,
        shrinkToLegend: true,
        title: "",
        width: layout.THIRD_CHART_WIDTH
      };

      const legendIconComponents: Record<
        string,
        React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
      > = {};

      if (chartKey === "tableShapeType") {
        if (originalLabels.includes("circularElliptic")) {
          const displayLabel = labelMap.get("circularElliptic");
          if (displayLabel !== undefined) {
            legendIconComponents[displayLabel] = CircularEllipticIcon;
          }
        }
        if (originalLabels.includes("rectangular")) {
          const displayLabel = labelMap.get("rectangular");
          if (displayLabel !== undefined) {
            legendIconComponents[displayLabel] = RectangularIcon;
          }
        }
      }

      if (chartKey === "sofaType" && originalLabels.includes("singleSeat")) {
        const displayLabel = labelMap.get("singleSeat");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = SingleSeatIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("stool")) {
        const displayLabel = labelMap.get("stool");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = StoolIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("dining")) {
        const displayLabel = labelMap.get("dining");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = DiningIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("swivel")) {
        const displayLabel = labelMap.get("swivel");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = SwivelIcon;
        }
      }

      if (chartKey === "chairLegType" && originalLabels.includes("four")) {
        const displayLabel = labelMap.get("four");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = FourIcon;
        }
      }

      if (chartKey === "chairLegType" && originalLabels.includes("star")) {
        const displayLabel = labelMap.get("star");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = StarIcon;
        }
      }

      if (chartKey === "chairArmType" && originalLabels.includes("missing")) {
        const displayLabel = labelMap.get("missing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairArmMissingIcon;
        }
      }

      if (chartKey === "chairArmType" && originalLabels.includes("existing")) {
        const displayLabel = labelMap.get("existing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairArmExistingIcon;
        }
      }

      if (chartKey === "chairBackType" && originalLabels.includes("missing")) {
        const displayLabel = labelMap.get("missing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairBackMissingIcon;
        }
      }

      if (chartKey === "chairBackType" && originalLabels.includes("existing")) {
        const displayLabel = labelMap.get("existing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ExistingIcon;
        }
      }

      if (chartKey === "storageType" && originalLabels.includes("shelf")) {
        const displayLabel = labelMap.get("shelf");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ShelfIcon;
        }
      }

      if (chartKey === "storageType" && originalLabels.includes("cabinet")) {
        const displayLabel = labelMap.get("cabinet");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = CabinetIcon;
        }
      }

      if (originalLabels.includes("unidentified")) {
        const displayLabel = labelMap.get("unidentified");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = UnidentifiedIcon;
        }
      }

      if (Object.keys(legendIconComponents).length > INITIAL_COUNT) {
        pieChartOptions.legendIconComponents = legendIconComponents;
      }

      charts[chartKey as AttributeChartKey] = getPieChartConfig(attributeLabels, attributeData, pieChartOptions);
    }
  }

  return charts;
}
