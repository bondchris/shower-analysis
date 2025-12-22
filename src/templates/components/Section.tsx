import React from "react";
import { ReportSection } from "../../models/report";
import { ChartConfiguration } from "../../utils/chartUtils";
import { BarChart, Histogram, LineChart, MixedChart, PieChart } from "./charts";
import { Table } from "./Table";

interface SectionProps {
  section: ReportSection;
}

export const Section: React.FC<SectionProps> = ({ section }) => {
  const DEFAULT_LEVEL = 2;
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 6;
  const MIN_TITLE_LEN = 0;

  const validLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, section.level ?? DEFAULT_LEVEL));
  const HeaderTag = `h${String(validLevel)}` as React.ElementType;
  const showTitle = section.title !== undefined && section.title.length > MIN_TITLE_LEN;

  const wrapperClass = ["chart", "summary", "chart-row"].includes(section.type) ? "break-inside-avoid" : "";

  const headerClasses: Record<number, string> = {
    1: "text-2xl font-bold text-center mb-2 text-gray-900", // Mostly handled by ReportShell but good fallback
    2: "text-lg font-semibold mt-4 mb-2 border-b border-gray-200 pb-2 text-gray-700 break-after-avoid",
    3: "text-sm font-semibold mt-3 mb-1 text-gray-600 break-after-avoid",
    4: "text-[13px] font-semibold mt-2 mb-1 text-gray-600 break-after-avoid",
    5: "text-sm font-semibold mb-2 text-gray-700 text-center",
    6: "text-xs font-semibold mb-1 text-gray-500"
  };

  return (
    <div className={wrapperClass}>
      {showTitle && <HeaderTag className={headerClasses[validLevel]}>{section.title}</HeaderTag>}
      <SectionContent section={section} />
    </div>
  );
};

const SectionContent: React.FC<SectionProps> = ({ section }) => {
  switch (section.type) {
    case "text":
      return <p>{(section.data as string | undefined) ?? ""}</p>;

    case "summary":
      return <p>{(section.data as string | undefined) ?? ""}</p>;

    case "table":
      return (
        <Table
          data={section.data as string[][]}
          options={section.options as { headers?: string[]; rowClasses?: Record<number, string> }}
        />
      );

    case "list":
      if (!Array.isArray(section.data)) {
        return null;
      }
      return (
        <div>
          {(section.data as string[]).map((item, i) => (
            <div
              key={i}
              className="mb-1 pl-4 relative text-xs before:content-['•'] before:absolute before:left-0 before:text-gray-400"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          ))}
        </div>
      );

    case "chart": {
      const chartConfig = section.data as ChartConfiguration;
      return (
        <div className="mb-2 flex w-full justify-start break-inside-avoid">
          {chartConfig.type === "line" && <LineChart config={chartConfig} />}
          {chartConfig.type === "histogram" && <Histogram config={chartConfig} />}
          {chartConfig.type === "bar" && <BarChart config={chartConfig} />}
          {chartConfig.type === "mixed" && <MixedChart config={chartConfig} />}
          {chartConfig.type === "pie" && <PieChart config={chartConfig} />}
        </div>
      );
    }

    case "chart-row":
      if (!Array.isArray(section.data)) {
        return null;
      }
      return (
        <div className="mb-2 flex justify-between gap-5 break-inside-avoid">
          {(section.data as { title?: string; data: ChartConfiguration }[]).map((chart, i) => (
            <div key={i} className="flex-1 text-center min-w-0">
              {chart.title !== undefined && (
                <h5 className="mb-2 text-center text-sm font-semibold text-gray-700">{chart.title}</h5>
              )}
              <div className="flex w-full justify-center">
                {chart.data.type === "line" && <LineChart config={chart.data} />}
                {chart.data.type === "histogram" && <Histogram config={chart.data} />}
                {chart.data.type === "bar" && <BarChart config={chart.data} />}
                {chart.data.type === "mixed" && <MixedChart config={chart.data} />}
                {chart.data.type === "pie" && <PieChart config={chart.data} />}
              </div>
            </div>
          ))}
        </div>
      );

    case "header":
      return null;

    case "page-break":
      return <div style={{ breakBefore: "page" }} />;

    case "react-component": {
      const Component = section.component;
      if (!Component) {
        return null;
      }
      return (
        <div className="mb-2 flex w-full justify-start break-inside-avoid">
          <Component />
        </div>
      );
    }

    default:
      if (section.data !== undefined) {
        return <p>{(section.data as string | undefined) ?? ""}</p>;
      }
      return null;
  }
};
