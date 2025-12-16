import React from "react";
import { ReportData } from "../../models/report";
import { Section } from "./Section";

interface ReportShellProps {
  data: ReportData;
  css: string;
}

export const ReportShell: React.FC<ReportShellProps> = ({ css, data }) => {
  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <h1>{data.title}</h1>
        <div className="report-meta">Generated: {new Date().toLocaleString()}</div>
        {data.subtitle !== undefined && <div className="report-subtitle">{data.subtitle}</div>}

        {data.sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
      </body>
    </html>
  );
};
