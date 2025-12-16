import React from "react";
import { ReportSection } from "../../models/report";
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

  const wrapperClass = ["chart", "summary", "chart-row"].includes(section.type) ? "avoid-page-break" : "";

  return (
    <div className={wrapperClass}>
      {showTitle && <HeaderTag>{section.title}</HeaderTag>}
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
            <div key={i} className="list-item" dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </div>
      );

    case "chart":
      return (
        <div className="chart-container">
          <img src={section.data as string} alt="Chart" />
        </div>
      );

    case "chart-row":
      if (!Array.isArray(section.data)) {
        return null;
      }
      return (
        <div className="chart-row-container">
          {(section.data as { title?: string; data: string }[]).map((chart, i) => (
            <div key={i} className="chart-item">
              {chart.title !== undefined && <h5>{chart.title}</h5>}
              <img src={chart.data} alt={chart.title ?? "Chart"} />
            </div>
          ))}
        </div>
      );

    case "header":
      return null;

    default:
      if (section.data !== undefined) {
        return <p>{(section.data as string | undefined) ?? ""}</p>;
      }
      return null;
  }
};
