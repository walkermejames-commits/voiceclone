import path from "node:path";

export interface ExtractedAudioMetadata {
  format: string | null;
  durationSeconds: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  bitrateKbps: number | null;
}

function roundNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function formatFromFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".wav") {
    return "wav";
  }
  if (extension === ".mp3") {
    return "mp3";
  }
  if (extension === ".m4a") {
    return "m4a";
  }
  return null;
}

function extractWavMetadata(buffer: Buffer): ExtractedAudioMetadata {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return {
      format: "wav",
      durationSeconds: null,
      sampleRateHz: null,
      channels: null,
      bitrateKbps: null,
    };
  }

  let offset = 12;
  let sampleRateHz: number | null = null;
  let channels: number | null = null;
  let byteRate: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt " && chunkDataOffset + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRateHz = buffer.readUInt32LE(chunkDataOffset + 4);
      byteRate = buffer.readUInt32LE(chunkDataOffset + 8);
    }

    if (chunkId === "data") {
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  const durationSeconds = byteRate && dataSize ? dataSize / byteRate : null;

  return {
    format: "wav",
    durationSeconds: roundNumber(durationSeconds),
    sampleRateHz,
    channels,
    bitrateKbps: byteRate ? roundNumber((byteRate * 8) / 1000, 1) : null,
  };
}

const MPEG_VERSIONS: Record<number, "2.5" | "2" | "1" | null> = {
  0: "2.5",
  1: null,
  2: "2",
  3: "1",
};

const LAYERS: Record<number, 1 | 2 | 3 | null> = {
  0: null,
  1: 3,
  2: 2,
  3: 1,
};

const BITRATES: Record<string, number[]> = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};

const SAMPLE_RATES: Record<string, number[]> = {
  "1": [44100, 48000, 32000, 0],
  "2": [22050, 24000, 16000, 0],
  "2.5": [11025, 12000, 8000, 0],
};

function skipId3(buffer: Buffer) {
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    return 10 + size;
  }

  return 0;
}

function extractMp3Metadata(buffer: Buffer): ExtractedAudioMetadata {
  let offset = skipId3(buffer);

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }

    const versionBits = (buffer[offset + 1] >> 3) & 0x03;
    const layerBits = (buffer[offset + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
    const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
    const channelMode = (buffer[offset + 3] >> 6) & 0x03;

    const version = MPEG_VERSIONS[versionBits];
    const layer = LAYERS[layerBits];
    if (!version || !layer) {
      offset += 1;
      continue;
    }

    const bitrateKey = `${version === "1" ? "1" : "2"}-${layer}`;
    const bitrateKbps = BITRATES[bitrateKey]?.[bitrateIndex] ?? 0;
    const sampleRateHz = SAMPLE_RATES[version]?.[sampleRateIndex] ?? 0;

    if (!bitrateKbps || !sampleRateHz) {
      offset += 1;
      continue;
    }

    const durationSeconds = ((buffer.length - offset) * 8) / (bitrateKbps * 1000);

    return {
      format: "mp3",
      durationSeconds: roundNumber(durationSeconds),
      sampleRateHz,
      channels: channelMode === 3 ? 1 : 2,
      bitrateKbps: roundNumber(bitrateKbps, 1),
    };
  }

  return {
    format: "mp3",
    durationSeconds: null,
    sampleRateHz: null,
    channels: null,
    bitrateKbps: null,
  };
}

export function audioContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".m4a") {
    return "audio/mp4";
  }
  if (extension === ".webm") {
    return "audio/webm";
  }
  return "application/octet-stream";
}

export function extractAudioMetadata(buffer: Buffer, fileName: string): ExtractedAudioMetadata {
  const format = formatFromFileName(fileName);
  if (format === "wav") {
    return extractWavMetadata(buffer);
  }
  if (format === "mp3") {
    return extractMp3Metadata(buffer);
  }

  return {
    format,
    durationSeconds: null,
    sampleRateHz: null,
    channels: null,
    bitrateKbps: null,
  };
}
