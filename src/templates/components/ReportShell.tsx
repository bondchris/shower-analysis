import React from "react";
import { ReportData } from "../../models/report";
import { Section } from "./Section";

interface ReportShellProps {
  data: ReportData;
  css: string;
}

const READY_SCRIPT = `
  document.addEventListener("DOMContentLoaded", () => {
    // Signal to Playwright that charts are ready (visx renders synchronously)
    window._chartsRendered = true;
  });
`;

export const ReportShell: React.FC<ReportShellProps> = ({ css, data }) => {
  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">{data.title}</h1>
        <div className="mb-5 text-center text-xs text-gray-500">Generated: {new Date().toLocaleString()}</div>
        {data.subtitle !== undefined && (
          <div className="mb-10 text-center text-base font-medium text-black">{data.subtitle}</div>
        )}

        {data.sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}

        <script dangerouslySetInnerHTML={{ __html: READY_SCRIPT }} />
      </body>
    </html>
  );
};
