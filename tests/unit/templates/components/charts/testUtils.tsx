import React from "react";
import { expect, vi } from "vitest";

interface AxisTickComponentProps {
  formattedValue: string;
  x?: number;
  y?: number;
  dy?: string;
}

type AxisTickLabelProps = (val: string, index: number, ticks: unknown[]) => void;

interface AxisBottomProps {
  tickComponent?: (props: AxisTickComponentProps) => React.ReactNode;
  tickLabelProps?: AxisTickLabelProps;
}

interface AxisLeftProps {
  tickComponent?: (props: AxisTickComponentProps) => React.ReactNode;
  tickFormat?: (val: string | number) => string;
  tickLabelProps?: AxisTickLabelProps;
}

/**
 * Common Visx mocks used by multiple chart tests.
 * Keeps render paths exercised (tickFormat/tickComponent) without expensive SVG.
 * The guard allows explicit setup in suites without double-mocking.
 */
let chartMocksReady = false;

export function setupChartVisxMocks(): void {
  if (chartMocksReady) {
    return;
  }
  chartMocksReady = true;

  vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));

  vi.mock("@visx/shape", () => ({
    AreaClosed: () => <path data-testid="mixed-area" />,
    Bar: () => <rect data-testid="visx-bar" />,
    Line: () => <line data-testid="separator-line" />,
    LinePath: () => <path />
  }));

  vi.mock("@visx/text", () => ({ Text: ({ children }: { children?: React.ReactNode }) => <text>{children}</text> }));

  vi.mock("@visx/grid", () => ({ GridColumns: () => <g />, GridRows: () => <g /> }));

  vi.mock("@visx/axis", () => ({
    AxisBottom: (props: AxisBottomProps) => {
      const tickNodes: React.ReactNode[] = [];
      if (props.tickComponent !== undefined) {
        const singleLineNode = props.tickComponent({ formattedValue: "SingleLabel", x: 0, y: 0 });
        const multilineNode = props.tickComponent({ formattedValue: "Line1\nLine2", x: 0, y: 0 });
        expect(singleLineNode).not.toBeUndefined();
        expect(multilineNode).not.toBeUndefined();
        tickNodes.push(<React.Fragment key="single">{singleLineNode}</React.Fragment>);
        tickNodes.push(<React.Fragment key="multi">{multilineNode}</React.Fragment>);
      }
      if (props.tickLabelProps !== undefined) {
        props.tickLabelProps("test", 0, []);
      }
      return <g data-testid="axis-bottom">{tickNodes}</g>;
    },
    AxisLeft: (props: AxisLeftProps) => {
      if (props.tickFormat !== undefined) {
        props.tickFormat("test-label");
        props.tickFormat("---");
        props.tickFormat("A long label that should probably be truncated because it is very long");
      }
      if (props.tickComponent !== undefined) {
        const leftNode = props.tickComponent({ formattedValue: "LeftTick", x: 0, y: 0 });
        expect(leftNode).not.toBeUndefined();
      }
      if (props.tickLabelProps !== undefined) {
        props.tickLabelProps("test", 0, []);
      }
      return <g data-testid="axis-left" />;
    },
    AxisRight: () => <g data-testid="axis-right" />
  }));
}

export function resetChartVisxMocks(): void {
  chartMocksReady = false;
  vi.resetModules();
  vi.clearAllMocks();
}

// Enable mocks on module import for convenience in chart tests, but suites may also call setupChartVisxMocks explicitly.
setupChartVisxMocks();
