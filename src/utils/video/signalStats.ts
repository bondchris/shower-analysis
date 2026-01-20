import { runFfprobe } from "./ffprobeUtils";

export interface LaplacianStats {
  frameCount: number;
  median: number;
  standardDeviation: number;
}

export async function calculateLaplacianStats(videoPath: string): Promise<LaplacianStats | null> {
  const escapedPath = videoPath.replace(/'/g, "\\'");
  const filterGraph = `movie='${escapedPath}',format=gray,convolution='0 1 0 1 -4 1 0 1 0',signalstats`;
  const compactFormat = "compact=p=0:nk=1";
  const outputField = "frame_tags=lavfi.signalstats.YAVG";
  const ffprobeArgs = ["-v", "error", "-of", compactFormat, "-show_entries", outputField, "-f", "lavfi", filterGraph];

  try {
    const stdoutValue = await runFfprobe(ffprobeArgs);

    const lines = stdoutValue.split(/\r?\n/);
    const values: number[] = [];
    const EMPTY_STRING_LENGTH = 0;
    const PIPE_TRAILER_LENGTH = 1;
    const FIRST_INDEX = 0;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed.length === EMPTY_STRING_LENGTH) {
        continue;
      }
      const cleaned = trimmed.endsWith("|")
        ? trimmed.slice(FIRST_INDEX, Math.max(FIRST_INDEX, trimmed.length - PIPE_TRAILER_LENGTH))
        : trimmed;
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) {
        values.push(parsed);
      }
    }

    const NO_VALUES = 0;
    if (values.length === NO_VALUES) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const EVEN_DIVISOR = 2;
    const EVEN_REMAINDER = 0;
    const PREVIOUS_OFFSET = 1;
    const DEFAULT_MEDIAN = 0;
    const middleIndex = Math.floor(sorted.length / EVEN_DIVISOR);
    let median: number = sorted[middleIndex] ?? sorted[FIRST_INDEX] ?? DEFAULT_MEDIAN;
    const hasEvenLength = sorted.length % EVEN_DIVISOR === EVEN_REMAINDER;
    if (hasEvenLength) {
      const previousIndex = middleIndex - PREVIOUS_OFFSET;
      const lowerValue: number = sorted[previousIndex] ?? median;
      const upperValue: number = sorted[middleIndex] ?? lowerValue;
      median = (lowerValue + upperValue) / EVEN_DIVISOR;
    }
    const INITIAL_SUM = 0;
    const sum = values.reduce((acc, value) => acc + value, INITIAL_SUM);
    const mean = sum / values.length;
    const variance = values.reduce((acc, value) => {
      const delta = value - mean;
      const squaredDelta = delta * delta;
      return acc + squaredDelta;
    }, INITIAL_SUM);
    const standardDeviation = Math.sqrt(variance / values.length);

    return {
      frameCount: values.length,
      median,
      standardDeviation
    };
  } catch {
    return null;
  }
}

export interface ColorStatistics {
  brightnessVariance: number;
  clippedPixelPercentage: number;
  greenMean: number;
  greenVariance: number;
  hueVariance: number;
  meanBrightness: number;
  meanHue: number;
  meanSaturation: number;
  redMean: number;
  redVariance: number;
  blueMean: number;
  blueVariance: number;
  saturationVariance: number;
  sampleCount: number;
}

export function calculateMeanAndVariance(values: number[]): { mean: number; variance: number } {
  const initialSum = 0;
  const validValues = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (validValues.length === initialSum) {
    return { mean: initialSum, variance: initialSum };
  }

  const mean = validValues.reduce((sum, value) => sum + value, initialSum) / validValues.length;
  const variance =
    validValues.reduce((sum, value) => {
      const delta = value - mean;
      const squaredDelta = delta * delta;
      return sum + squaredDelta;
    }, initialSum) / validValues.length;

  return { mean, variance };
}

function selectColorCoefficients(colorSpace?: string): { kb: number; kr: number } {
  const space = (colorSpace ?? "").toLowerCase();
  const defaultCoefficients = { kb: 0.0722, kr: 0.2126 }; // BT.709
  if (space.includes("601")) {
    return { kb: 0.114, kr: 0.299 };
  }
  if (space.includes("2020")) {
    return { kb: 0.0593, kr: 0.2627 };
  }
  return defaultCoefficients;
}

export function convertYuvToRgb(
  yAvg: number,
  uAvg: number,
  vAvg: number,
  colorRange?: string,
  colorSpace?: string
): { b: number; g: number; r: number } {
  const minChannelValue = 0;
  const maxChannelValue = 255;
  const chromaCenter = 128;
  const limitedLumaOffset = 16;
  const lumaDenominator = 219;
  const chromaDenominator = 224;
  const lumaScaleLimited = maxChannelValue / lumaDenominator;
  const chromaScaleLimited = maxChannelValue / chromaDenominator;

  const fullRangeScale = 1;
  const channelScaleMultiplier = 2;

  const clamp = (value: number): number => {
    return Math.min(maxChannelValue, Math.max(minChannelValue, value));
  };
  const fullRangeLabel = "pc";
  const effectiveRange = (colorRange ?? fullRangeLabel).toLowerCase();
  const useFullRange = effectiveRange === fullRangeLabel;
  const lumaOffset = useFullRange ? minChannelValue : limitedLumaOffset;
  const lumaScale = useFullRange ? fullRangeScale : lumaScaleLimited;
  const chromaScale = useFullRange ? fullRangeScale : chromaScaleLimited;

  const normalizedY = (yAvg - lumaOffset) * lumaScale;
  const normalizedU = (uAvg - chromaCenter) * chromaScale;
  const normalizedV = (vAvg - chromaCenter) * chromaScale;

  const { kb, kr } = selectColorCoefficients(colorSpace);
  const kg = fullRangeScale - kr - kb;
  const redScale = channelScaleMultiplier * (fullRangeScale - kr);
  const blueScale = channelScaleMultiplier * (fullRangeScale - kb);
  const greenBlueComponent = (kb / kg) * blueScale;
  const greenRedComponent = (kr / kg) * redScale;

  const redContribution = redScale * normalizedV;
  const blueContribution = blueScale * normalizedU;
  const greenBlueAdjustment = greenBlueComponent * normalizedU;
  const greenRedAdjustment = greenRedComponent * normalizedV;
  const greenAdjustment = greenBlueAdjustment + greenRedAdjustment;

  const red = normalizedY + redContribution;
  const blue = normalizedY + blueContribution;
  const green = normalizedY - greenAdjustment;

  return { b: clamp(blue), g: clamp(green), r: clamp(red) };
}

export async function calculateColorStatistics(
  videoPath: string,
  options: { colorRange?: string; colorSpace?: string }
): Promise<ColorStatistics | null> {
  const escapedPath = videoPath.replace(/'/g, "\\'");
  const filterGraph = `movie='${escapedPath}',signalstats=stat=brng`;
  const tagPrefix = "lavfi.signalstats.";
  const tagList = ["YAVG", "HUEAVG", "SATAVG", "UAVG", "VAVG", "BRNG", "YMIN", "YMAX", "YBITDEPTH"];
  const tagEntries = tagList.map((tag) => `${tagPrefix}${tag}`).join(",");
  const ffprobeArgs = [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-show_entries",
    `frame_tags=${tagEntries}`,
    "-of",
    "json",
    filterGraph
  ];
  const fullRangeLabel = "pc";
  const effectiveRange = (options.colorRange ?? fullRangeLabel).toLowerCase();
  const useFullRange = effectiveRange === fullRangeLabel;
  const limitedLumaOffset = 16;
  const lumaReference = 255;
  const lumaDenominator = 219;
  const fullRangeOffset = 0;
  const fullRangeScale = 1;
  const lumaScaleLimited = lumaReference / lumaDenominator;
  const lumaOffset = useFullRange ? fullRangeOffset : limitedLumaOffset;
  const lumaScale = useFullRange ? fullRangeScale : lumaScaleLimited;
  const defaultBitDepth = 8;
  const minSignalValue = 0;
  const lastElementOffset = 1;
  const bitDepthBase = 2;
  const maxSignalAdjustment = 1;
  const percentScale = 100;
  const percentMin = 0;
  const percentMax = 100;

  try {
    const stdoutValue = await runFfprobe(ffprobeArgs);

    const parsedJson: unknown = JSON.parse(stdoutValue);
    const frames: { tags?: Record<string, string> }[] = Array.isArray((parsedJson as { frames?: unknown }).frames)
      ? ((parsedJson as { frames?: { tags?: Record<string, string> }[] }).frames as { tags?: Record<string, string> }[])
      : [];

    const parseNumericTag = (tags: Record<string, string> | undefined, tagName: string): number | null => {
      if (tags === undefined) {
        return null;
      }
      const raw = tags[tagName];
      if (raw === undefined) {
        return null;
      }
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const brightnessValues: number[] = [];
    const hueValues: number[] = [];
    const saturationValues: number[] = [];
    const uValues: number[] = [];
    const vValues: number[] = [];
    const clippingFractions: number[] = [];
    const bitDepths: number[] = [];
    const rawYValues: number[] = [];
    let clippedFrameCount = 0;

    const saturationThreshold = 0.15;
    const saturationNormalizationMax = 100;

    for (const frame of frames) {
      const tags = frame.tags;
      const brightness = parseNumericTag(tags, `${tagPrefix}YAVG`);
      const hue = parseNumericTag(tags, `${tagPrefix}HUEAVG`);
      const saturation = parseNumericTag(tags, `${tagPrefix}SATAVG`);
      const uAvg = parseNumericTag(tags, `${tagPrefix}UAVG`);
      const vAvg = parseNumericTag(tags, `${tagPrefix}VAVG`);
      const brng = parseNumericTag(tags, `${tagPrefix}BRNG`);
      const yMin = parseNumericTag(tags, `${tagPrefix}YMIN`);
      const yMax = parseNumericTag(tags, `${tagPrefix}YMAX`);
      const yBitDepth = parseNumericTag(tags, `${tagPrefix}YBITDEPTH`);

      if (yBitDepth !== null) {
        bitDepths.push(yBitDepth);
      }
      if (brightness !== null) {
        rawYValues.push(brightness);
        const normalizedBrightness = (brightness - lumaOffset) * lumaScale;
        brightnessValues.push(normalizedBrightness);
      }
      if (saturation !== null) {
        saturationValues.push(saturation);
        const normalizedSaturation = saturation / saturationNormalizationMax;
        if (hue !== null && normalizedSaturation > saturationThreshold) {
          hueValues.push(hue);
        }
      }
      if (uAvg !== null && vAvg !== null && brightness !== null) {
        uValues.push(uAvg);
        vValues.push(vAvg);
      }
      if (brng !== null) {
        clippingFractions.push(brng);
      }
      const effectiveBitDepth =
        yBitDepth !== null && yBitDepth > minSignalValue
          ? Math.round(yBitDepth)
          : (bitDepths[bitDepths.length - lastElementOffset] ?? defaultBitDepth);
      const maxSignalValue = Math.pow(bitDepthBase, effectiveBitDepth) - maxSignalAdjustment;
      const hasMinClipping = yMin !== null && yMin <= minSignalValue;
      const hasMaxClipping = yMax !== null && yMax >= maxSignalValue;
      if (hasMinClipping || hasMaxClipping) {
        clippedFrameCount += lastElementOffset;
      }
    }

    const sampleCount = brightnessValues.length;
    const { mean: meanBrightness, variance: brightnessVariance } = calculateMeanAndVariance(brightnessValues);
    const { mean: meanHue, variance: hueVariance } = calculateMeanAndVariance(hueValues);
    const { mean: meanSaturation, variance: saturationVariance } = calculateMeanAndVariance(saturationValues);
    const { mean: avgBrng } = calculateMeanAndVariance(clippingFractions);
    let clippedPixelPercentage = percentMin;
    const hasClippingFractions = clippingFractions.length > minSignalValue;
    if (hasClippingFractions) {
      clippedPixelPercentage = avgBrng * percentScale;
    } else if (sampleCount > minSignalValue) {
      clippedPixelPercentage = (clippedFrameCount / sampleCount) * percentScale;
    }
    clippedPixelPercentage = Math.min(percentMax, Math.max(percentMin, clippedPixelPercentage));

    const rgbMeans = rawYValues.map((brightness, index) => {
      const uAvg = uValues[index] ?? uValues[uValues.length - lastElementOffset] ?? brightness;
      const vAvg = vValues[index] ?? vValues[vValues.length - lastElementOffset] ?? brightness;
      return convertYuvToRgb(brightness, uAvg, vAvg, options.colorRange, options.colorSpace);
    });
    const redMeans = rgbMeans.map((value) => value.r);
    const greenMeans = rgbMeans.map((value) => value.g);
    const blueMeans = rgbMeans.map((value) => value.b);

    const { mean: redMean, variance: redVariance } = calculateMeanAndVariance(redMeans);
    const { mean: greenMean, variance: greenVariance } = calculateMeanAndVariance(greenMeans);
    const { mean: blueMean, variance: blueVariance } = calculateMeanAndVariance(blueMeans);

    return {
      blueMean,
      blueVariance,
      brightnessVariance,
      clippedPixelPercentage,
      greenMean,
      greenVariance,
      hueVariance,
      meanBrightness,
      meanHue,
      meanSaturation,
      redMean,
      redVariance,
      sampleCount,
      saturationVariance
    };
  } catch {
    return null;
  }
}
