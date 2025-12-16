import React from "react";

interface TableProps {
  data: string[][];
  options?: {
    headers?: string[];
    rowClasses?: Record<number, string>;
  };
}

export const Table: React.FC<TableProps> = ({ data, options }) => {
  const headers = options?.headers ?? [];
  const rowClasses = options?.rowClasses ?? {};
  const MIN_HEADERS = 0;

  // For dangerouslySetInnerHTML usage in cells (if we want HTML in cells, which the original code seemed to allow implies simple strings but generated via TS code that expected HTML behavior? No, original was template strings.
  // Wait, let's look at `renderTable` in original: `html += <td>${cell}</td>`.
  // If `cell` contained HTML (e.g. badges), it would be rendered as HTML.
  // We need to support HTML in cells for Badges.

  return (
    <table>
      {headers.length > MIN_HEADERS && (
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className={rowClasses[rowIndex]}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} dangerouslySetInnerHTML={{ __html: cell }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
