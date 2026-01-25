// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Point } from "../../../../../src/models/point";
import { LayoutElement } from "../../../../../src/utils/room/layout/roomLayoutGenerator";
import { RoomLayoutSvg } from "../../../../../src/utils/room/layout/RoomLayoutSvg";

describe("RoomLayoutSvg", () => {
  const defaultBounds = { maxX: 10, maxY: 10, minX: 0, minY: 0 };
  const defaultWidth = 800;
  const defaultHeight = 800;
  const defaultPadding = 40;
  const defaultOptions = {};

  it("should render an SVG element", () => {
    const elements: LayoutElement[] = [];
    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("data-testid")).toBe("room-layout-svg");
  });

  it("should render floor polygon", () => {
    const elements: LayoutElement[] = [
      {
        label: "Floor",
        points: [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)],
        type: "floor"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("should render wall lines", () => {
    const elements: LayoutElement[] = [
      {
        label: "Wall",
        points: [new Point(0, 0), new Point(10, 0)],
        type: "wall"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("should render objects with correct colors", () => {
    const elements: LayoutElement[] = [
      {
        label: "toilet",
        objectType: "toilet",
        points: [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)],
        type: "object"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const objectPath = container.querySelector('path[fill="#7c3aed"]');
    expect(objectPath).toBeTruthy();
  });

  it("should render doors with dashed lines", () => {
    const elements: LayoutElement[] = [
      {
        label: "Door",
        points: [new Point(0, 0), new Point(1, 0)],
        type: "door"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const doorPath = container.querySelector('path[stroke-dasharray="8,4"]');
    expect(doorPath).toBeTruthy();
  });

  it("should render windows with dashed lines", () => {
    const elements: LayoutElement[] = [
      {
        label: "Window",
        points: [new Point(0, 0), new Point(1, 0)],
        type: "window"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const windowPath = container.querySelector('path[stroke-dasharray="4,2"]');
    expect(windowPath).toBeTruthy();
  });

  it("should render labels when showLabels is true", () => {
    const elements: LayoutElement[] = [
      {
        label: "toilet",
        objectType: "toilet",
        points: [new Point(5, 5), new Point(6, 5), new Point(6, 6), new Point(5, 6)],
        type: "object"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={{ showLabels: true }}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const text = container.querySelector("text");
    expect(text).toBeTruthy();
    expect(text?.textContent).toBe("toilet");
  });

  it("should not render labels when showLabels is false", () => {
    const elements: LayoutElement[] = [
      {
        label: "toilet",
        objectType: "toilet",
        points: [new Point(5, 5), new Point(6, 5), new Point(6, 6), new Point(5, 6)],
        type: "object"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={{ showLabels: false }}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const text = container.querySelector("text");
    expect(text).toBeNull();
  });

  it("should use custom colors when provided", () => {
    const elements: LayoutElement[] = [
      {
        label: "Wall",
        points: [new Point(0, 0), new Point(10, 0)],
        type: "wall"
      }
    ];

    const customWallColor = "#ff0000";
    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={{ wallColor: customWallColor }}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const wallPath = container.querySelector(`path[stroke="${customWallColor}"]`);
    expect(wallPath).toBeTruthy();
  });

  it("should render background rectangle", () => {
    const elements: LayoutElement[] = [];
    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const bgRect = container.querySelector('rect[fill="#ffffff"]');
    expect(bgRect).toBeTruthy();
  });

  it("should handle empty points array gracefully", () => {
    const elements: LayoutElement[] = [
      {
        label: "Empty",
        points: [],
        type: "object"
      }
    ];

    expect(() =>
      render(
        <RoomLayoutSvg
          bounds={defaultBounds}
          elements={elements}
          height={defaultHeight}
          options={defaultOptions}
          padding={defaultPadding}
          width={defaultWidth}
        />
      )
    ).not.toThrow();
  });

  it("should handle unknown object types with default color", () => {
    const elements: LayoutElement[] = [
      {
        label: "unknown",
        objectType: "unknownType",
        points: [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)],
        type: "object"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const objectPath = container.querySelector('path[fill="#9ca3af"]');
    expect(objectPath).toBeTruthy();
  });

  it("should handle objects without objectType", () => {
    const elements: LayoutElement[] = [
      {
        label: "test",
        points: [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)],
        type: "object"
      }
    ];

    const { container } = render(
      <RoomLayoutSvg
        bounds={defaultBounds}
        elements={elements}
        height={defaultHeight}
        options={defaultOptions}
        padding={defaultPadding}
        width={defaultWidth}
      />
    );

    const objectPath = container.querySelector('path[fill="#9ca3af"]');
    expect(objectPath).toBeTruthy();
  });

  it("should handle single point walls gracefully", () => {
    const elements: LayoutElement[] = [
      {
        label: "Wall",
        points: [new Point(0, 0)],
        type: "wall"
      }
    ];

    expect(() =>
      render(
        <RoomLayoutSvg
          bounds={defaultBounds}
          elements={elements}
          height={defaultHeight}
          options={defaultOptions}
          padding={defaultPadding}
          width={defaultWidth}
        />
      )
    ).not.toThrow();
  });

  it("should handle very small bounds", () => {
    const smallBounds = { maxX: 0.001, maxY: 0.001, minX: 0, minY: 0 };
    const elements: LayoutElement[] = [
      {
        label: "Floor",
        points: [new Point(0, 0), new Point(0.001, 0), new Point(0.001, 0.001), new Point(0, 0.001)],
        type: "floor"
      }
    ];

    expect(() =>
      render(
        <RoomLayoutSvg
          bounds={smallBounds}
          elements={elements}
          height={defaultHeight}
          options={defaultOptions}
          padding={defaultPadding}
          width={defaultWidth}
        />
      )
    ).not.toThrow();
  });

  it("should handle zero-width bounds", () => {
    const zeroBounds = { maxX: 5, maxY: 10, minX: 5, minY: 0 };
    const elements: LayoutElement[] = [
      {
        label: "Wall",
        points: [new Point(5, 0), new Point(5, 10)],
        type: "wall"
      }
    ];

    expect(() =>
      render(
        <RoomLayoutSvg
          bounds={zeroBounds}
          elements={elements}
          height={defaultHeight}
          options={defaultOptions}
          padding={defaultPadding}
          width={defaultWidth}
        />
      )
    ).not.toThrow();
  });

  it("should render all object types with correct colors", () => {
    const objectTypes = [
      { color: "#0ea5e9", type: "bathtub" },
      { color: "#ec4899", type: "bed" },
      { color: "#22c55e", type: "chair" },
      { color: "#14b8a6", type: "dishwasher" },
      { color: "#b91c1c", type: "fireplace" },
      { color: "#dc2626", type: "oven" },
      { color: "#3b82f6", type: "refrigerator" },
      { color: "#06b6d4", type: "sink" },
      { color: "#f97316", type: "sofa" },
      { color: "#6b7280", type: "stairs" },
      { color: "#f59e0b", type: "storage" },
      { color: "#ef4444", type: "stove" },
      { color: "#84cc16", type: "table" },
      { color: "#1f2937", type: "television" },
      { color: "#7c3aed", type: "toilet" },
      { color: "#8b5cf6", type: "washerDryer" }
    ];

    for (const { color, type } of objectTypes) {
      const elements: LayoutElement[] = [
        {
          label: type,
          objectType: type,
          points: [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1)],
          type: "object"
        }
      ];

      const { container } = render(
        <RoomLayoutSvg
          bounds={defaultBounds}
          elements={elements}
          height={defaultHeight}
          options={defaultOptions}
          padding={defaultPadding}
          width={defaultWidth}
        />
      );

      const objectPath = container.querySelector(`path[fill="${color}"]`);
      expect(objectPath).toBeTruthy();
    }
  });
});
