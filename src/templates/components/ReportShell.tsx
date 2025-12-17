import React from "react";
import { ReportData } from "../../models/report";
import { Section } from "./Section";

interface ReportShellProps {
  data: ReportData;
  css: string;
  chartLib?: string;
  datalabelsLib?: string;
}

const HYDRATION_SCRIPT = `
  document.addEventListener("DOMContentLoaded", () => {
    // Register the datalabels plugin globally if available
    if (ChartDataLabels) {
      Chart.register(ChartDataLabels);
    }

    const canvases = document.querySelectorAll("canvas.chart-canvas");
    canvases.forEach((canvas) => {
      try {
        const configStr = canvas.getAttribute("data-config");
        if (!configStr) return;
        
        const config = JSON.parse(configStr);

        // Hydrate special flags
        const datalabelsConfig = config.options?.plugins?.datalabels;
        if (datalabelsConfig && datalabelsConfig._percentageTotal) {
           const total = datalabelsConfig._percentageTotal;
           datalabelsConfig.formatter = (value) => {
             const pct = (value / total) * 100;
             return parseFloat(pct.toFixed(2)) + "%";
           };
        }

        new Chart(canvas, config);
        
        // Mark as rendered for Playwright to wait on
        canvas.setAttribute("data-rendered", "true");
      } catch (e) {
        console.error("Chart render error:", e);
      }
    });
    
    // Global flag for Playwright
    window._chartsRendered = true;
  });
`;

export const ReportShell: React.FC<ReportShellProps> = ({ chartLib, css, data, datalabelsLib }) => {
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

        {chartLib !== undefined && <script dangerouslySetInnerHTML={{ __html: chartLib }} />}
        {datalabelsLib !== undefined && <script dangerouslySetInnerHTML={{ __html: datalabelsLib }} />}
        <script dangerouslySetInnerHTML={{ __html: HYDRATION_SCRIPT }} />
      </body>
    </html>
  );
};
