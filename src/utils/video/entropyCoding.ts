import * as fs from "fs";

import ffmpeg from "fluent-ffmpeg";

function safeByteAt(buffer: Buffer, index: number): number | undefined {
  const MIN_INDEX = 0;
  if (index < MIN_INDEX || index >= buffer.length) {
    return undefined;
  }
  return buffer[index];
}

function extractAvcCFromFile(videoPath: string): Buffer | undefined {
  const AVC_MARKER = "avcC";
  const MARKER_LENGTH = 4;
  const HEADER_SIZE = 8;
  const SIZE_BYTES = 4;
  const MIN_PAYLOAD_SIZE = 1;

  try {
    const fileBuffer = fs.readFileSync(videoPath);
    const markerBuffer = Buffer.from(AVC_MARKER, "ascii");
    let searchStart = 0;
    const NOT_FOUND = -1;
    while (searchStart < fileBuffer.length) {
      const markerIndex = fileBuffer.indexOf(markerBuffer, searchStart);
      if (markerIndex === NOT_FOUND) {
        return undefined;
      }
      searchStart = markerIndex + MARKER_LENGTH;
      if (markerIndex < SIZE_BYTES) {
        continue;
      }
      const headerEnd = markerIndex + MARKER_LENGTH;
      if (headerEnd > fileBuffer.length) {
        continue;
      }

      const sizeFieldStart = markerIndex - SIZE_BYTES;
      const sizeFieldEnd = sizeFieldStart + SIZE_BYTES;
      if (sizeFieldEnd > fileBuffer.length) {
        continue;
      }

      const totalSize = fileBuffer.readUInt32BE(sizeFieldStart);
      const payloadSize = totalSize - HEADER_SIZE;
      if (payloadSize < MIN_PAYLOAD_SIZE) {
        continue;
      }

      const payloadStart = markerIndex + MARKER_LENGTH;
      const payloadEnd = payloadStart + payloadSize;
      if (payloadEnd > fileBuffer.length) {
        continue;
      }

      return fileBuffer.subarray(payloadStart, payloadEnd);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function removeEmulationPreventionBytes(nal: Buffer): Buffer {
  const TRIPLE_BYTE_WINDOW = 3;
  const ZERO_BYTE = 0x00;
  const PREVENTION_BYTE = 0x03;
  const START_INDEX = 0;
  const SINGLE_BYTE_STEP = 1;
  const PREVENTION_SKIP_COUNT = 2;
  const SECOND_BYTE_OFFSET = 1;
  const THIRD_BYTE_OFFSET = 2;
  const cleaned: number[] = [];
  for (let i = START_INDEX; i < nal.length; i += SINGLE_BYTE_STEP) {
    const currentByte = safeByteAt(nal, i);
    const secondByte = safeByteAt(nal, i + SECOND_BYTE_OFFSET);
    const thirdByte = safeByteAt(nal, i + THIRD_BYTE_OFFSET);
    if (currentByte === undefined) {
      continue;
    }
    const remaining = nal.length - i;
    const hasPreventionSequence =
      remaining >= TRIPLE_BYTE_WINDOW &&
      currentByte === ZERO_BYTE &&
      secondByte === ZERO_BYTE &&
      thirdByte === PREVENTION_BYTE;
    if (hasPreventionSequence) {
      cleaned.push(currentByte, secondByte as number);
      i += PREVENTION_SKIP_COUNT;
      continue;
    }
    cleaned.push(currentByte);
  }
  return Buffer.from(cleaned);
}

const BIT_READER_INITIAL_POSITION = 0;
const BIT_READER_INCREMENT = 1;

class BitReader {
  private readonly buffer: Buffer;
  private bitPosition = BIT_READER_INITIAL_POSITION;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readBits(count: number): number {
    const BITS_PER_BYTE = 8;
    const BIT_BASE = 2;
    const MOST_SIGNIFICANT_BIT = 7;
    const INITIAL_VALUE = 0;
    const maxBits = this.buffer.length * BITS_PER_BYTE;
    if (this.bitPosition + count > maxBits) {
      throw new Error("Not enough bits to read");
    }

    let value = INITIAL_VALUE;
    for (let i = INITIAL_VALUE; i < count; i += BIT_READER_INCREMENT) {
      const byteIndex = Math.floor(this.bitPosition / BITS_PER_BYTE);
      const bitOffset = MOST_SIGNIFICANT_BIT - (this.bitPosition % BITS_PER_BYTE);
      const byte = safeByteAt(this.buffer, byteIndex);
      if (byte === undefined) {
        throw new Error("BitReader read out of range");
      }
      const bit = Math.floor(byte / Math.pow(BIT_BASE, bitOffset)) % BIT_BASE;
      const scaledValue = value * BIT_BASE;
      value = scaledValue + bit;
      this.bitPosition += BIT_READER_INCREMENT;
    }
    return value;
  }

  readUE(): number {
    const BIT_BASE = 2;
    const SINGLE_BIT = 1;
    const NO_LEADING_ZEROS = 0;
    let leadingZeroBits = NO_LEADING_ZEROS;
    while (this.readBits(SINGLE_BIT) === NO_LEADING_ZEROS) {
      leadingZeroBits += SINGLE_BIT;
    }
    if (leadingZeroBits === NO_LEADING_ZEROS) {
      return NO_LEADING_ZEROS;
    }
    const suffix = this.readBits(leadingZeroBits);
    const baseValue = Math.pow(BIT_BASE, leadingZeroBits);
    const ADJUSTMENT = 1;
    return baseValue - ADJUSTMENT + suffix;
  }
}

function parsePpsForEntropyCoding(ppsNal: Buffer): string | undefined {
  const MIN_NAL_LENGTH = 2;
  if (ppsNal.length < MIN_NAL_LENGTH) {
    return undefined;
  }
  const FIRST_BYTE = 1;
  const rbsp = removeEmulationPreventionBytes(ppsNal.subarray(FIRST_BYTE)); // drop NAL header
  try {
    const reader = new BitReader(rbsp);
    reader.readUE(); // pps_pic_parameter_set_id
    reader.readUE(); // seq_parameter_set_id
    const ENTROPY_FLAG_BITS = 1;
    const CABAC_FLAG = 1;
    const entropyFlag = reader.readBits(ENTROPY_FLAG_BITS);
    return entropyFlag === CABAC_FLAG ? "CABAC" : "CAVLC";
  } catch {
    return undefined;
  }
}

function parseAvcCForPps(avcC: Buffer): Buffer | undefined {
  const MIN_HEADER_LENGTH = 6;
  const LENGTH_FIELD_SIZE = 2;
  const SPS_MODULO = 32;
  const PPS_COUNT_OFFSET = 1;
  if (avcC.length < MIN_HEADER_LENGTH) {
    return undefined;
  }

  const SPS_COUNT_POSITION = 5; // position of numOfSequenceParameterSets
  const initialOffset = SPS_COUNT_POSITION;
  let offset = initialOffset;
  const spsCountByte = safeByteAt(avcC, offset);
  if (spsCountByte === undefined) {
    return undefined;
  }
  const spsCount = spsCountByte % SPS_MODULO;
  offset += PPS_COUNT_OFFSET;

  for (let i = 0; i < spsCount; i += PPS_COUNT_OFFSET) {
    if (offset + LENGTH_FIELD_SIZE > avcC.length) {
      return undefined;
    }
    const spsLength = avcC.readUInt16BE(offset);
    offset += LENGTH_FIELD_SIZE + spsLength;
    if (offset > avcC.length) {
      return undefined;
    }
  }

  if (offset >= avcC.length) {
    return undefined;
  }

  const ppsCountByte = safeByteAt(avcC, offset);
  if (ppsCountByte === undefined) {
    return undefined;
  }
  const ppsCount = ppsCountByte;
  offset += PPS_COUNT_OFFSET;

  for (let i = 0; i < ppsCount; i += PPS_COUNT_OFFSET) {
    if (offset + LENGTH_FIELD_SIZE > avcC.length) {
      return undefined;
    }
    const ppsLength = avcC.readUInt16BE(offset);
    offset += LENGTH_FIELD_SIZE;
    const end = offset + ppsLength;
    if (end > avcC.length) {
      return undefined;
    }
    const ppsNal = avcC.subarray(offset, end);
    const MIN_PPS_DATA_LENGTH = 0;
    if (ppsNal.length > MIN_PPS_DATA_LENGTH) {
      return ppsNal;
    }
    offset = end;
  }

  return undefined;
}

function parseAnnexBPps(data: Buffer): Buffer | undefined {
  const START_CODE_PADDING = 0x00;
  const START_CODE_MARKER = 0x01;
  const START_CODE_SHORT_VALUES = [START_CODE_PADDING, START_CODE_PADDING, START_CODE_MARKER];
  const START_CODE_LONG_VALUES = [START_CODE_PADDING, START_CODE_PADDING, START_CODE_PADDING, START_CODE_MARKER];
  const START_CODE_SHORT = Buffer.from(START_CODE_SHORT_VALUES);
  const START_CODE_LONG = Buffer.from(START_CODE_LONG_VALUES);
  const ppsNalType = 8;
  const MIN_START_CODE_LENGTH = 3;
  const NAL_TYPE_MODULO = 32;
  const FIRST_NAL_INDEX = 0;
  const NAL_TYPE_INDEX = 0;
  const PREVIOUS_BYTE = 1;
  const EMPTY_NAL_LENGTH = 0;

  const startCodes = [START_CODE_LONG, START_CODE_SHORT];

  const INDEX_STEP = 1;
  for (let i = FIRST_NAL_INDEX; i < data.length; i += INDEX_STEP) {
    let startCodeLength = FIRST_NAL_INDEX;
    for (const sc of startCodes) {
      const candidate = data.subarray(i, i + sc.length);
      if (candidate.equals(sc)) {
        startCodeLength = sc.length;
        break;
      }
    }
    if (startCodeLength === FIRST_NAL_INDEX) {
      continue;
    }

    const nalStart = i + startCodeLength;
    let nalEnd = data.length;
    for (let j = nalStart; j < data.length - MIN_START_CODE_LENGTH; j += INDEX_STEP) {
      if (
        data.subarray(j, j + START_CODE_LONG.length).equals(START_CODE_LONG) ||
        data.subarray(j, j + START_CODE_SHORT.length).equals(START_CODE_SHORT)
      ) {
        nalEnd = j;
        break;
      }
    }

    const nal = data.subarray(nalStart, nalEnd);
    const nalTypeByte = safeByteAt(nal, NAL_TYPE_INDEX);
    if (nalTypeByte === undefined) {
      return undefined;
    }
    const nalType = nal.length > EMPTY_NAL_LENGTH ? nalTypeByte % NAL_TYPE_MODULO : FIRST_NAL_INDEX;
    if (nalType === ppsNalType) {
      return nal;
    }
    i = nalEnd - PREVIOUS_BYTE; // continue scanning after this NAL
  }

  return undefined;
}

export function detectEntropyCodingMode(stream: ffmpeg.FfprobeStream, videoPath: string): string {
  const extradataBase64 = (stream as Record<string, unknown>)["extradata_base64"];
  const extradataHex = (stream as Record<string, unknown>)["extradata"];

  const candidateBuffers: Buffer[] = [];
  const NO_BUFFERS = 0;

  if (typeof extradataBase64 === "string") {
    try {
      candidateBuffers.push(Buffer.from(extradataBase64, "base64"));
    } catch {
      // ignore invalid base64
    }
  }

  if (typeof extradataHex === "string") {
    try {
      candidateBuffers.push(Buffer.from(extradataHex, "hex"));
    } catch {
      // ignore invalid hex
    }
  }

  if (candidateBuffers.length === NO_BUFFERS) {
    const avcC = extractAvcCFromFile(videoPath);
    if (avcC !== undefined) {
      candidateBuffers.push(avcC);
    }
  }

  const ppsNalType = 8;
  const NAL_TYPE_MODULO = 32;
  const FIRST_BYTE_INDEX = 0;
  const DEFAULT_ENTROPY_STRING = "";

  for (const buffer of candidateBuffers) {
    const ppsFromAvcC = parseAvcCForPps(buffer);
    if (ppsFromAvcC !== undefined) {
      const entropy = parsePpsForEntropyCoding(ppsFromAvcC);
      if (entropy !== undefined) {
        return entropy;
      }
    }

    const ppsFromAnnexB = parseAnnexBPps(buffer);
    if (ppsFromAnnexB !== undefined) {
      const nalFirstByte = safeByteAt(ppsFromAnnexB, FIRST_BYTE_INDEX);
      if (nalFirstByte !== undefined && nalFirstByte % NAL_TYPE_MODULO === ppsNalType) {
        const entropy = parsePpsForEntropyCoding(ppsFromAnnexB);
        if (entropy !== undefined) {
          return entropy;
        }
      }
    }
  }

  return DEFAULT_ENTROPY_STRING;
}
