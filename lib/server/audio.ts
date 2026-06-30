const SAMPLE_RATE = 22050;

interface ParsedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Int16Array;
}

function clampSample(value: number) {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

function createWaveBuffer(samples: Int16Array, sampleRate = SAMPLE_RATE) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(samples[index], 44 + index * 2);
  }

  return buffer;
}

function parseWaveBuffer(buffer: Buffer): ParsedWav {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported WAV file");
  }

  let offset = 12;
  let sampleRate = SAMPLE_RATE;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + size + (size % 2);

    if (chunk === "fmt ") {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunk === "data") {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }

    offset = next;
  }

  if (dataOffset < 0 || channels !== 1 || bitsPerSample !== 16) {
    throw new Error("Only 16-bit mono WAV files are supported");
  }

  const sampleCount = dataSize / 2;
  const samples = new Int16Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = buffer.readInt16LE(dataOffset + index * 2);
  }

  return { sampleRate, channels, bitsPerSample, samples };
}

function durationToSamples(milliseconds: number) {
  return Math.max(1, Math.round((milliseconds / 1000) * SAMPLE_RATE));
}

export function createSilenceWav(milliseconds: number) {
  return createWaveBuffer(new Int16Array(durationToSamples(milliseconds)));
}

function renderDoorEffect() {
  const length = durationToSamples(900);
  const samples = new Int16Array(length);
  const hits = [0, 0.32];

  for (const hit of hits) {
    const start = Math.floor(hit * SAMPLE_RATE);
    const duration = Math.floor(0.18 * SAMPLE_RATE);
    for (let index = 0; index < duration && start + index < length; index += 1) {
      const t = index / SAMPLE_RATE;
      const envelope = Math.exp(-12 * t);
      const tone =
        Math.sin(2 * Math.PI * 96 * t) * 0.65 +
        Math.sin(2 * Math.PI * 144 * t) * 0.35;
      const noise = (Math.random() * 2 - 1) * 0.2;
      samples[start + index] += clampSample((tone + noise) * envelope * 7000);
    }
  }

  return createWaveBuffer(samples);
}

function renderFootstepsEffect() {
  const length = durationToSamples(1300);
  const samples = new Int16Array(length);
  const steps = [0.05, 0.32, 0.66, 0.96];

  for (const step of steps) {
    const start = Math.floor(step * SAMPLE_RATE);
    const duration = Math.floor(0.12 * SAMPLE_RATE);
    for (let index = 0; index < duration && start + index < length; index += 1) {
      const t = index / SAMPLE_RATE;
      const envelope = Math.exp(-20 * t);
      const tone = Math.sin(2 * Math.PI * 140 * t);
      samples[start + index] += clampSample(tone * envelope * 9000);
    }
  }

  return createWaveBuffer(samples);
}

function renderRainEffect() {
  const length = durationToSamples(1700);
  const samples = new Int16Array(length);
  let drift = 0;

  for (let index = 0; index < length; index += 1) {
    drift = drift * 0.93 + (Math.random() * 2 - 1) * 0.07;
    const hiss = (Math.random() * 2 - 1) * 0.35;
    samples[index] = clampSample((drift + hiss) * 5000);
  }

  return createWaveBuffer(samples);
}

function renderChimeEffect() {
  const length = durationToSamples(750);
  const samples = new Int16Array(length);

  for (let index = 0; index < length; index += 1) {
    const t = index / SAMPLE_RATE;
    const envelope = Math.exp(-5 * t);
    const tone =
      Math.sin(2 * Math.PI * 523.25 * t) * 0.6 +
      Math.sin(2 * Math.PI * 659.25 * t) * 0.4;
    samples[index] = clampSample(tone * envelope * 8000);
  }

  return createWaveBuffer(samples);
}

export function createSfxWav(tag: string) {
  const normalized = tag.trim().toLowerCase();

  if (normalized.includes("rain")) {
    return renderRainEffect();
  }

  if (normalized.includes("door")) {
    return renderDoorEffect();
  }

  if (normalized.includes("foot")) {
    return renderFootstepsEffect();
  }

  return renderChimeEffect();
}

export function concatWavFiles(buffers: Buffer[]) {
  if (buffers.length === 0) {
    throw new Error("No audio clips to combine");
  }

  const parsed = buffers.map(parseWaveBuffer);
  const sampleRate = parsed[0].sampleRate;
  const combinedLength = parsed.reduce((sum, clip) => {
    if (clip.sampleRate !== sampleRate) {
      throw new Error("Sample rates do not match");
    }

    return sum + clip.samples.length;
  }, 0);

  const combined = new Int16Array(combinedLength);
  let cursor = 0;

  for (const clip of parsed) {
    combined.set(clip.samples, cursor);
    cursor += clip.samples.length;
  }

  return createWaveBuffer(combined, sampleRate);
}
