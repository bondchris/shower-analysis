import React, { useId, useMemo } from "react";

interface SphericalCoverageGlobeProps {
  coveragePercent: number;
  grid: number[][];
  maxSeconds: number;
  nonZeroBins: number;
  totalSeconds: number;
}

export const SphericalCoverageGlobe: React.FC<SphericalCoverageGlobeProps> = ({
  coveragePercent,
  grid,
  maxSeconds,
  nonZeroBins,
  totalSeconds
}) => {
  const minSeconds = 0;
  const defaultMaxSeconds = 1;
  const binCenterOffset = 0.5;
  const halfDivisor = 2;
  const minPixelRadius = 1.5;
  const sphereRadiusPx = 70;
  const paddingPx = 6;
  const colorExponent = 0.55;
  const hueStart = 195;
  const hueEnd = 10;
  const lightStart = 78;
  const lightEnd = 40;
  const saturation = 90;
  const dotAlpha = 0.9;
  const gradientStartColor = "#f7fafc";
  const gradientEndColor = "#d7e0e7";
  const strokeColor = "#b5c1cb";
  const svgDisplaySize = 150;
  const maxNormalized = 1;
  const fieldBlurStdDeviation = 8;
  const fieldOpacity = 0.85;
  const fieldRadiusMultiplier = 1.35;
  const statsDecimalsPercent = 1;
  const statsDecimalsMax = 2;
  const statsDecimalsAvg = 3;
  const firstRowIndex = 0;
  const gradientStart = 0;
  const gradientEnd = 1;
  const svgDiameter = sphereRadiusPx * halfDivisor;
  const svgSize = svgDiameter + paddingPx;
  const center = svgSize / halfDivisor;

  const safeMaxSeconds = maxSeconds > minSeconds ? maxSeconds : defaultMaxSeconds;
  const rows = grid.length;
  const cols = grid[firstRowIndex]?.length ?? minSeconds;
  const hasCoverage = rows > minSeconds && cols > minSeconds;
  const fallbackBinCount = rows * cols;
  const seenBins = nonZeroBins > minSeconds ? nonZeroBins : fallbackBinCount;
  const averageSeconds = seenBins > minSeconds ? totalSeconds / seenBins : minSeconds;

  const gradientPrefix = useId();

  const colorForValue = (value: number): string => {
    const normalizedBase = Math.min(Math.max(value / safeMaxSeconds, minSeconds), maxNormalized);
    const normalized = Math.pow(normalizedBase, colorExponent);
    const hueDelta = (hueEnd - hueStart) * normalized;
    const lightDelta = (lightEnd - lightStart) * normalized;
    const hue = hueStart + hueDelta;
    const lightness = lightStart + lightDelta;
    return `hsla(${hue.toString()}, ${saturation.toString()}%, ${lightness.toString()}%, ${dotAlpha.toString()})`;
  };

  const viewDots = useMemo(() => {
    const twoPi = Math.PI * halfDivisor;
    const halfPi = Math.PI / halfDivisor;
    const latStep = rows > minSeconds ? Math.PI / rows : minSeconds;
    const lonStep = cols > minSeconds ? twoPi / cols : minSeconds;
    const angularSize = Math.max(latStep, lonStep) / halfDivisor;
    const pixelRadius = Math.max(minPixelRadius, sphereRadiusPx * Math.sin(angularSize));

    const normalizeVector = (vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
      const lengthSquaredX = vector.x * vector.x;
      const lengthSquaredY = vector.y * vector.y;
      const lengthSquaredZ = vector.z * vector.z;
      const lengthSquared = lengthSquaredX + lengthSquaredY + lengthSquaredZ;
      const minLength = 1e-6;
      const unitMagnitude = 1;
      if (lengthSquared < minLength) {
        return { x: minSeconds, y: minSeconds, z: minSeconds };
      }
      const length = Math.sqrt(lengthSquared);
      const invLength = unitMagnitude / length;
      return {
        x: vector.x * invLength,
        y: vector.y * invLength,
        z: vector.z * invLength
      };
    };

    const dotProduct = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number => {
      const productX = a.x * b.x;
      const productY = a.y * b.y;
      const productZ = a.z * b.z;
      return productX + productY + productZ;
    };

    const baseViews = [
      {
        basis: {
          forward: { x: 0, y: 0, z: 1 },
          right: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 }
        },
        key: "front",
        label: "Front"
      },
      {
        basis: {
          forward: { x: 0, y: 0, z: -1 },
          right: { x: -1, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 }
        },
        key: "back",
        label: "Back"
      },
      {
        basis: {
          forward: { x: 0, y: 1, z: 0 },
          right: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 0, z: 1 }
        },
        key: "top",
        label: "Top-down"
      },
      {
        basis: {
          forward: { x: 0, y: -1, z: 0 },
          right: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 0, z: 1 }
        },
        key: "bottom",
        label: "Bottom-up"
      }
    ];

    return baseViews.map((view) => {
      const forward = normalizeVector(view.basis.forward);
      const right = normalizeVector(view.basis.right);
      const up = normalizeVector(view.basis.up);
      const dots: { cx: number; cy: number; radius: number; value: number; key: string }[] = [];

      for (let r = 0; r < rows; r++) {
        const latPosition = (r + binCenterOffset) / rows;
        const latAngle = latPosition * Math.PI;
        const latCenter = latAngle - halfPi;
        const cosLat = Math.cos(latCenter);
        const sinLat = Math.sin(latCenter);

        for (let c = 0; c < cols; c++) {
          const lonPosition = (c + binCenterOffset) / cols;
          const lonAngle = lonPosition * twoPi;
          const lonCenter = lonAngle - Math.PI;
          const cosLon = Math.cos(lonCenter);
          const sinLon = -Math.sin(lonCenter);

          const normal = {
            x: cosLat * sinLon,
            y: sinLat,
            z: cosLat * cosLon
          };

          const facingAmount = dotProduct(normal, forward);
          if (facingAmount <= minSeconds) {
            continue;
          }

          const value = grid[r]?.[c] ?? minSeconds;
          if (value <= minSeconds) {
            continue;
          }

          const projectedX = sphereRadiusPx * dotProduct(normal, right);
          const projectedY = sphereRadiusPx * dotProduct(normal, up);
          const screenX = center + projectedX;
          const screenY = center - projectedY;
          const key = `${view.key}-${r.toString()}-${c.toString()}`;

          dots.push({
            cx: screenX,
            cy: screenY,
            key,
            radius: pixelRadius,
            value
          });
        }
      }

      return {
        ...view,
        dots,
        gradientId: `${gradientPrefix}-${view.key}`,
        interpolatedId: `${gradientPrefix}-${view.key}-field`
      };
    });
  }, [
    binCenterOffset,
    center,
    cols,
    gradientPrefix,
    grid,
    halfDivisor,
    minPixelRadius,
    minSeconds,
    rows,
    sphereRadiusPx
  ]);

  if (!hasCoverage) {
    return <div className="text-xs text-gray-600">No coverage data available.</div>;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="text-sm font-semibold text-gray-800">Spherical Coverage (multi-view)</div>
      <div className="flex flex-wrap gap-3">
        {viewDots.map((v) => (
          <div key={v.key} className="flex flex-col items-center gap-1">
            <svg
              role="img"
              aria-label={`Spherical coverage ${v.label}`}
              data-testid={`${v.key}-globe`}
              className="rounded-full border border-gray-200 shadow-sm"
              height={svgDisplaySize}
              width={svgDisplaySize}
              viewBox={`0 0 ${svgSize.toString()} ${svgSize.toString()}`}
            >
              <defs>
                <radialGradient id={v.gradientId} cx="45%" cy="45%" r="70%">
                  <stop offset={gradientStart} stopColor={gradientStartColor} />
                  <stop offset={gradientEnd} stopColor={gradientEndColor} />
                </radialGradient>
                <filter id={v.interpolatedId} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation={fieldBlurStdDeviation} />
                </filter>
              </defs>
              <circle cx={center} cy={center} r={sphereRadiusPx} fill={`url(#${v.gradientId})`} stroke={strokeColor} />
              <g filter={`url(#${v.interpolatedId})`}>
                {v.dots.map((dot) => (
                  <circle
                    key={`${dot.key}-field`}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={dot.radius * fieldRadiusMultiplier}
                    fill={colorForValue(dot.value)}
                    opacity={fieldOpacity}
                    data-coverage-dot
                  />
                ))}
              </g>
            </svg>
            <div className="text-[10px] text-gray-600">{v.label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-[10px] leading-snug text-gray-700">
        <div className="font-semibold text-gray-800">Stats</div>
        <div>Avg Coverage: {coveragePercent.toFixed(statsDecimalsPercent)}% of sphere</div>
        <div>Max dwell in bin: {maxSeconds.toFixed(statsDecimalsMax)} s</div>
        <div>Avg dwell per bin: {averageSeconds.toFixed(statsDecimalsAvg)} s</div>
      </div>
    </div>
  );
};
