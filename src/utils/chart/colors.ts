import chroma from "chroma-js";

export function kelvinToRgb(kelvin: number): string {
  const zeroValue = 0;
  const defaultAlpha = 0.8;
  if (!Number.isFinite(kelvin) || kelvin <= zeroValue) {
    return `rgba(0, 0, 0, ${defaultAlpha.toString()})`;
  }

  const color = chroma.temperature(kelvin);
  const [r, g, b] = color.rgb();
  return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${defaultAlpha.toString()})`;
}
