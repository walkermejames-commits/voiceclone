import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getPresetConfig } from "@/lib/shared/presets";
import type { DeliveryPreset } from "@/lib/shared/types";

const execFileAsync = promisify(execFile);
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

export class NarratorError extends Error {
  constructor(
    message: string,
    public readonly code: "non-windows" | "powershell" | "no-voices",
  ) {
    super(message);
    this.name = "NarratorError";
  }
}

function ensureWindows() {
  if (process.platform !== "win32") {
    throw new NarratorError(
      "ChipVoice Studio V1 generates narration with Windows System.Speech. Run it on Windows 10/11, or use non-audio features only on this platform.",
      "non-windows",
    );
  }
}

function singleQuote(value: string) {
  return value.replace(/'/g, "''");
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function applyPronunciations(text: string, dictionary: Record<string, string>) {
  const entries = Object.entries(dictionary);
  if (entries.length === 0) {
    return escapeXml(text);
  }

  const pattern = new RegExp(
    `\\b(${entries
      .map(([key]) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "gi",
  );

  return escapeXml(text).replace(pattern, (match) => {
    const resolved =
      entries.find(([key]) => key.toLowerCase() === match.toLowerCase())?.[1] ?? match;
    return `<sub alias="${escapeXml(resolved)}">${escapeXml(match)}</sub>`;
  });
}

function addPunctuationBreaks(text: string, pauseMs: number) {
  return text
    .replace(/,\s*/g, `, <break time="${Math.round(pauseMs * 0.4)}ms" /> `)
    .replace(/[;:]\s*/g, (match) => {
      const mark = match.trim();
      return `${mark} <break time="${Math.round(pauseMs * 0.7)}ms" /> `;
    })
    .replace(/\u2014\s*/g, `\u2014 <break time="${Math.round(pauseMs * 0.85)}ms" /> `);
}

function buildSsml(
  text: string,
  pace: number,
  pauseMs: number,
  preset: DeliveryPreset,
  voice: string,
  dictionary: Record<string, string>,
) {
  const presetConfig = getPresetConfig(preset);
  const ratePercent = Math.round((pace * presetConfig.paceMultiplier - 1) * 100);
  const adjustedPause = Math.round(pauseMs * presetConfig.pauseMultiplier);
  const content = addPunctuationBreaks(applyPronunciations(text, dictionary), adjustedPause);

  return `
<speak version="1.0" xml:lang="en-GB">
  <voice name="${escapeXml(voice)}">
    <prosody rate="${ratePercent >= 0 ? `+${ratePercent}` : ratePercent}%">
      ${content}
    </prosody>
  </voice>
</speak>`.trim();
}

async function runPowerShell(script: string) {
  ensureWindows();
  try {
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
    const { stdout, stderr } = await execFileAsync(
      POWERSHELL,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodedCommand],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 8,
      },
    );

    if (stderr && stderr.trim()) {
      throw new NarratorError(`Windows narrator failed: ${stderr.trim()}`, "powershell");
    }

    return stdout.trim();
  } catch (error) {
    if (error instanceof NarratorError) {
      throw error;
    }
    throw new NarratorError(
      error instanceof Error ? `Windows narrator failed: ${error.message}` : "Windows narrator failed.",
      "powershell",
    );
  }
}

export async function listInstalledVoices() {
  const output = await runPowerShell(`
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$names = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
$synth.Dispose()
$names -join "\`n"
`);

  return output
    .split(/\r?\n/)
    .map((voice) => voice.trim())
    .filter(Boolean);
}

export async function getNarratorStatus() {
  if (process.platform !== "win32") {
    return {
      ok: false,
      platform: process.platform,
      voices: [] as string[],
      voiceCount: 0,
      message:
        "Windows System.Speech narration is available only on Windows. The app can still build here, but audio generation needs Windows.",
    };
  }

  try {
    const voices = await listInstalledVoices();
    return {
      ok: voices.length > 0,
      platform: process.platform,
      voices,
      voiceCount: voices.length,
      message:
        voices.length > 0
          ? `${voices.length} Windows narrator voice(s) found.`
          : "No Windows narrator voices were found. Install a Windows speech voice, then restart the dev server.",
    };
  } catch (error) {
    return {
      ok: false,
      platform: process.platform,
      voices: [] as string[],
      voiceCount: 0,
      message: error instanceof Error ? error.message : "Could not inspect Windows narrator voices.",
    };
  }
}

export async function synthesizeToWav(params: {
  text: string;
  voice: string;
  pace: number;
  pauseMs: number;
  preset: DeliveryPreset;
  pronunciationDictionary: Record<string, string>;
  outputPath: string;
}) {
  await mkdir(path.dirname(params.outputPath), { recursive: true });
  const ssml = buildSsml(
    params.text,
    params.pace,
    params.pauseMs,
    params.preset,
    params.voice,
    params.pronunciationDictionary,
  );

  const ssmlBase64 = Buffer.from(ssml, "utf8").toString("base64");
  const script = `
Add-Type -AssemblyName System.Speech
$ssml = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${ssmlBase64}'))
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('${singleQuote(params.voice)}')
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile('${singleQuote(params.outputPath)}', $format)
$synth.SpeakSsml($ssml)
$synth.Dispose()
`;

  await runPowerShell(script);
}
