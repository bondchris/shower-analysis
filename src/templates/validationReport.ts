import { EnvStats } from "../models/envStats";
import { ReportData, ReportSection } from "../models/report";
import { ValidationCharts, generateValidationCharts } from "./validationReport/charts";
import { buildChartSections, buildIdListSections, buildSummaryTableSection } from "./validationReport/sections";

export function buildValidationReport(allStats: EnvStats[]): ReportData {
  const NO_STATS = 0;

  if (allStats.length === NO_STATS) {
    return {
      sections: [{ data: "No environments / no data.", type: "text" }],
      title: "Validation Report"
    };
  }

  const charts: ValidationCharts = generateValidationCharts(allStats);
  const { section: summaryTableSection, sortedStats } = buildSummaryTableSection(allStats);

  const sections: ReportSection[] = [
    summaryTableSection,
    ...buildChartSections(charts),
    ...buildIdListSections(sortedStats)
  ];

  return {
    sections,
    title: "Validation Report"
  };
}

export { buildChartSections, buildIdListSections, buildSummaryTableSection, generateValidationCharts };
