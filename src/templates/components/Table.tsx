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
    <table className="mb-5 w-full table-auto border-collapse text-[11px]">
      {headers.length > MIN_HEADERS && (
        <thead>
          <tr className="break-inside-avoid">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-r border-gray-200 border-gray-700 bg-black px-3 py-2 text-center font-semibold text-white print:print-color-adjust-exact first:whitespace-nowrap first:text-left last:border-r-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className={`break-inside-avoid ${rowClasses[rowIndex] ?? ""}`}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="break-words border-b border-r border-gray-100 border-gray-200 px-3 py-2 text-center text-gray-600 first:whitespace-nowrap first:text-left last:border-r-0"
                dangerouslySetInnerHTML={{ __html: cell }}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
