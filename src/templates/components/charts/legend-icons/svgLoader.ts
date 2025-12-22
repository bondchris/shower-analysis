import * as fs from "fs";
import * as path from "path";

/**
 * Loads an SVG file and extracts its inner content (without the <svg> wrapper).
 * Replaces `currentColor` with the provided color.
 */
export function loadSvgContent(svgPath: string, color: string): string {
  const fullPath = path.join(process.cwd(), svgPath);
  const svgContent = fs.readFileSync(fullPath, "utf-8");

  // Extract content between <svg> tags
  const svgTagRegex = /<svg[^>]*>([\s\S]*)<\/svg>/i;
  const svgTagMatch = svgTagRegex.exec(svgContent);
  const firstCaptureGroupIndex = 1;
  const innerContent = svgTagMatch?.[firstCaptureGroupIndex];
  if (innerContent === undefined) {
    throw new Error(`Invalid SVG file: ${svgPath}`);
  }

  let processedContent = innerContent;

  // Replace currentColor with the actual color in all contexts
  // This handles: fill="currentColor", fill:currentColor, and standalone currentColor
  processedContent = processedContent.replace(/currentColor/gi, color);

  return processedContent;
}
