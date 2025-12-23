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

  // Handle CSS classes in style tags: inline fill/stroke attributes and remove style tags
  // Style tags don't work when injected into <g> elements via dangerouslySetInnerHTML
  // Find style tags and extract fill/stroke colors from class rules
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleTagMatch: RegExpExecArray | null = null;
  const processedClasses: { className: string; fillColor?: string; strokeColor?: string }[] = [];

  // Process each style tag
  const allStyleTags: string[] = [];
  const styleTagMatchIndex = 0;
  const styleContentIndex = 1;
  while ((styleTagMatch = styleTagRegex.exec(processedContent)) !== null) {
    allStyleTags.push(styleTagMatch[styleTagMatchIndex]);
    const styleContent = styleTagMatch[styleContentIndex];
    if (styleContent !== undefined) {
      // Look for class rules - extract both fill and stroke
      const classRuleRegex = /\.([\w-]+)\s*\{([^}]*)\}/gi;
      let classRuleMatch: RegExpExecArray | null = null;
      const classNameIndex = 1;
      const propertiesIndex = 2;
      while ((classRuleMatch = classRuleRegex.exec(styleContent)) !== null) {
        const className = classRuleMatch[classNameIndex];
        const properties = classRuleMatch[propertiesIndex];
        if (className !== undefined && properties !== undefined) {
          // Helper to extract color value from regex match
          const extractColor = (match: RegExpExecArray | null): string | undefined => {
            const colorMatchIndex = 1;
            if (match === null) {
              return undefined;
            }
            const colorValue = match[colorMatchIndex];
            return colorValue !== undefined ? colorValue.trim() : undefined;
          };

          // Extract fill color if present
          const fillRegex = /fill\s*:\s*([^;}\s]+)/i;
          const fillMatch = fillRegex.exec(properties);
          const fillColorValue = extractColor(fillMatch);

          // Extract stroke color if present
          const strokeRegex = /stroke\s*:\s*([^;}\s]+)/i;
          const strokeMatch = strokeRegex.exec(properties);
          const strokeColorValue = extractColor(strokeMatch);

          // Only add if we found at least one color property
          if (fillColorValue !== undefined || strokeColorValue !== undefined) {
            const classInfo: { className: string; fillColor?: string; strokeColor?: string } = { className };
            if (fillColorValue !== undefined) {
              classInfo.fillColor = fillColorValue;
            }
            if (strokeColorValue !== undefined) {
              classInfo.strokeColor = strokeColorValue;
            }
            processedClasses.push(classInfo);
          }
        }
      }
    }
  }

  // Inline fill/stroke attributes on elements with the processed classes
  for (const { className, fillColor, strokeColor } of processedClasses) {
    // Match elements with class="className" or class='className'
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const elementWithClassRegex = new RegExp(`(<[^>]+)class=["']${escapedClassName}["']([^>]*>)`, "gi");
    processedContent = processedContent.replace(elementWithClassRegex, (_match, before: string, after: string) => {
      let result = before;

      // Add fill attribute if specified and not already present
      if (fillColor !== undefined && !/fill\s*=\s*["']/.test(result)) {
        result += ` fill="${fillColor}"`;
      }

      // Add stroke attribute if specified and not already present
      if (strokeColor !== undefined && !/stroke\s*=\s*["']/.test(result)) {
        result += ` stroke="${strokeColor}"`;
      }

      // Keep the class attribute
      result += ` class="${className}"${after}`;
      return result;
    });
  }

  // Remove all style tags
  for (const styleTag of allStyleTags) {
    processedContent = processedContent.replace(styleTag, "");
  }

  return processedContent;
}
