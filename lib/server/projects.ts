import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import mammoth from "mammoth";

import { extractAudioMetadata } from "@/lib/server/reference-audio";
import { concatWavFiles, createSfxWav, createSilenceWav } from "@/lib/server/audio";
import {
  createEmptyAnnotatedScript,
  createEmptyRecordingWorkspace,
  generateAnnotatedScript,
} from "@/lib/server/performance-script";
import { dictionaryToLines, parseDictionaryInput, parseManuscriptToChapters } from "@/lib/server/parser";
import { NarratorError, getNarratorStatus, listInstalledVoices, synthesizeToWav } from "@/lib/server/narrator";
import {
  annotatedScriptFile,
  ensureProjectScaffold,
  listProjectIds,
  pathExists,
  projectFile,
  readJsonFile,
  recordingsFile,
  safeProjectPath,
  sanitizeFileSegment,
  writeBufferFile,
  writeJsonFile,
} from "@/lib/server/storage";
import type {
  AnnotatedScript,
  ChapterItem,
  ProjectRecord,
  ProjectSummary,
  ReferenceNarrationAnalysis,
  ReferenceNarrationAsset,
  ReferenceNarrationAssetType,
  RecordingTake,
  RecordingWorkspace,
  SentenceItem,
} from "@/lib/shared/types";

function nowIso() {
  return new Date().toISOString();
}

function createReferenceAnalysis(): ReferenceNarrationAnalysis {
  return {
    estimatedAveragePaceNote: "",
    manualStyleSummary: "",
    referenceTags: [],
    placeholders: {
      pausePatternAnalysis: null,
      speakingRateEstimation: null,
      pronunciationComparison: null,
      deliveryStyleNotes: null,
    },
  };
}

type StoredProjectRecord = Omit<ProjectRecord, "annotatedScript" | "recordingWorkspace">;

function normaliseAnnotatedScript(projectId: string, annotatedScript?: Partial<AnnotatedScript> | null): AnnotatedScript {
  const base = createEmptyAnnotatedScript(projectId);
  return {
    ...base,
    ...annotatedScript,
    speakerProfiles: annotatedScript?.speakerProfiles ?? base.speakerProfiles,
    lines: annotatedScript?.lines ?? base.lines,
  };
}

function normaliseRecordingWorkspace(
  recordingWorkspace?: Partial<RecordingWorkspace> | null,
): RecordingWorkspace {
  return {
    ...createEmptyRecordingWorkspace(),
    ...recordingWorkspace,
    takes: recordingWorkspace?.takes ?? [],
  };
}

function normaliseReferenceAssetType(value: string): ReferenceNarrationAssetType {
  if (
    value === "style-reference" ||
    value === "pronunciation-reference" ||
    value === "pacing-reference" ||
    value === "demo-narration" ||
    value === "archival-audio"
  ) {
    return value;
  }

  return "style-reference";
}

function normaliseReferenceAsset(
  projectId: string,
  asset: Partial<ReferenceNarrationAsset>,
): ReferenceNarrationAsset {
  return {
    id: asset.id ?? randomUUID(),
    projectId,
    title: asset.title?.trim() || asset.originalFilename?.trim() || "Reference narration",
    originalFilename: asset.originalFilename?.trim() || "reference-audio",
    filePath: asset.filePath ?? "",
    format: asset.format ?? null,
    durationSeconds: asset.durationSeconds ?? null,
    sampleRateHz: asset.sampleRateHz ?? null,
    channels: asset.channels ?? null,
    bitrateKbps: asset.bitrateKbps ?? null,
    notes: asset.notes ?? "",
    assetType: normaliseReferenceAssetType(asset.assetType ?? "style-reference"),
    uploadedAt: asset.uploadedAt ?? nowIso(),
    analysis: {
      ...createReferenceAnalysis(),
      ...asset.analysis,
      referenceTags: asset.analysis?.referenceTags ?? [],
      placeholders: {
        ...createReferenceAnalysis().placeholders,
        ...asset.analysis?.placeholders,
      },
    },
  };
}

function normaliseProject(project: ProjectRecord): ProjectRecord {
  const referenceNarrationAssets = Array.isArray(project.referenceNarrationAssets)
    ? project.referenceNarrationAssets.map((asset) => normaliseReferenceAsset(project.id, asset))
    : [];
  const primaryReferenceAssetId =
    project.primaryReferenceAssetId &&
    referenceNarrationAssets.some((asset) => asset.id === project.primaryReferenceAssetId)
      ? project.primaryReferenceAssetId
      : referenceNarrationAssets[0]?.id ?? null;

  return {
    ...project,
    referenceNarrationAssets,
    primaryReferenceAssetId,
    annotatedScript: normaliseAnnotatedScript(project.id, project.annotatedScript),
    recordingWorkspace: normaliseRecordingWorkspace(project.recordingWorkspace),
  };
}

function summariseProject(
  project: Pick<
    ProjectRecord,
    "id" | "title" | "author" | "updatedAt" | "chapters" | "generationStatus"
  >,
): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    author: project.author,
    updatedAt: project.updatedAt,
    chapterCount: project.chapters.length,
    generatedSentences: project.generationStatus.generatedSentences,
    totalSentences: project.generationStatus.totalSentences,
    generatedChapters: project.generationStatus.generatedChapters,
    totalChapters: project.generationStatus.totalChapters,
  };
}

function recomputeStatuses(project: ProjectRecord): ProjectRecord {
  const totalSentences = project.chapters.reduce(
    (sum, chapter) => sum + chapter.sentences.filter((sentence) => Boolean(sentence.text.trim())).length,
    0,
  );
  const generatedSentences = project.chapters.reduce(
    (sum, chapter) =>
      sum +
      chapter.sentences.filter(
        (sentence) =>
          Boolean(sentence.audioPath) && (Boolean(sentence.text.trim()) || Boolean(sentence.sfxTag)),
      ).length,
    0,
  );
  const generatedChapters = project.chapters.filter((chapter) => Boolean(chapter.previewAudioPath)).length;

  project.generationStatus = {
    state:
      totalSentences === 0
        ? "empty"
        : generatedSentences === 0
          ? "ready"
          : generatedSentences === totalSentences && generatedChapters === project.chapters.length
            ? "ready"
            : "in-progress",
    generatedSentences,
    totalSentences,
    generatedChapters,
    totalChapters: project.chapters.length,
  };

  return project;
}

function createProjectId(title: string) {
  const stem = sanitizeFileSegment(title || "chipvoice-project");
  return `${stem}-${randomUUID().slice(0, 8)}`;
}

async function saveProject(project: ProjectRecord) {
  project.updatedAt = nowIso();
  await ensureProjectScaffold(project.id);
  const normalised = normaliseProject(recomputeStatuses(project));
  const { annotatedScript, recordingWorkspace, ...storedProject } = normalised;
  await writeJsonFile(projectFile(project.id), storedProject satisfies StoredProjectRecord);
  await writeJsonFile(annotatedScriptFile(project.id), annotatedScript);
  await writeJsonFile(recordingsFile(project.id), recordingWorkspace);
  return normalised;
}

async function loadProjectRecord(projectId: string): Promise<ProjectRecord> {
  const project = await readJsonFile<StoredProjectRecord>(projectFile(projectId));
  const [hasAnnotatedScript, hasRecordingWorkspace] = await Promise.all([
    pathExists(annotatedScriptFile(projectId)),
    pathExists(recordingsFile(projectId)),
  ]);
  const [annotatedScript, recordingWorkspace] = await Promise.all([
    hasAnnotatedScript
      ? readJsonFile<AnnotatedScript>(annotatedScriptFile(projectId))
      : Promise.resolve(createEmptyAnnotatedScript(projectId)),
    hasRecordingWorkspace
      ? readJsonFile<RecordingWorkspace>(recordingsFile(projectId))
      : Promise.resolve(createEmptyRecordingWorkspace()),
  ]);

  return normaliseProject({
    ...project,
    annotatedScript,
    recordingWorkspace,
  });
}

export async function getVoices() {
  const voices = await listInstalledVoices();
  if (voices.length === 0) {
    throw new NarratorError(
      "No Windows narrator voices were found. Install a Windows speech voice, then restart the dev server.",
      "no-voices",
    );
  }
  return voices;
}

export { getNarratorStatus };

export async function listProjects() {
  const ids = await listProjectIds();
  const projects = await Promise.all(
    ids.map(async (id) => {
      if (!(await pathExists(projectFile(id)))) {
        return null;
      }

      return readJsonFile<StoredProjectRecord>(projectFile(id));
    }),
  );

  return projects
    .filter((project): project is StoredProjectRecord => Boolean(project))
    .map(summariseProject)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getProject(projectId: string) {
  const project = await loadProjectRecord(projectId);
  return recomputeStatuses(project);
}

export async function createProject(input: {
  title: string;
  author: string;
  description?: string;
}) {
  const voices = await getVoices();
  const id = createProjectId(input.title);
  const createdAt = nowIso();

  const project: ProjectRecord = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description?.trim() ?? "",
    createdAt,
    updatedAt: createdAt,
    manuscriptText: "",
    narrator: {
      name: "House Narrator",
      provider: "Windows System.Speech",
      voice: voices[0],
      defaultPace: 1,
      defaultPauseMs: 380,
      defaultDeliveryPreset: "neutral",
      pronunciationDictionary: {},
    },
    chapters: [
      {
        id: randomUUID(),
        index: 0,
        title: "Chapter 1",
        previewAudioPath: null,
        sentences: [
          {
            id: randomUUID(),
            index: 0,
            text: "",
            originalText: "",
            pace: 1,
            pauseMs: 380,
            deliveryPreset: "neutral",
            pronunciationOverrides: {},
            sfxTag: null,
            audioPath: null,
          },
        ],
      },
    ],
    referenceNarrationAssets: [],
    primaryReferenceAssetId: null,
    annotatedScript: createEmptyAnnotatedScript(id),
    recordingWorkspace: createEmptyRecordingWorkspace(),
    generationStatus: {
      state: "empty",
      generatedSentences: 0,
      totalSentences: 0,
      generatedChapters: 0,
      totalChapters: 1,
    },
    exportStatus: {
      lastBundleExportAt: null,
      lastChapterExportAt: null,
    },
  };

  await saveProject(project);
  return project;
}

function clearAudio(project: ProjectRecord) {
  for (const chapter of project.chapters) {
    chapter.previewAudioPath = null;
    for (const sentence of chapter.sentences) {
      sentence.audioPath = null;
    }
  }

  project.exportStatus.lastBundleExportAt = null;
  project.exportStatus.lastChapterExportAt = null;
}

export async function updateProject(
  projectId: string,
  payload: {
    title: string;
    author: string;
    description: string;
    narratorName: string;
    voice: string;
    defaultPace: number;
    defaultPauseMs: number;
    defaultDeliveryPreset: ProjectRecord["narrator"]["defaultDeliveryPreset"];
    pronunciationLines: string;
  },
) {
  const project = await getProject(projectId);
  const voiceChanged = project.narrator.voice !== payload.voice;
  const defaultsChanged =
    project.narrator.defaultPace !== payload.defaultPace ||
    project.narrator.defaultPauseMs !== payload.defaultPauseMs ||
    project.narrator.defaultDeliveryPreset !== payload.defaultDeliveryPreset ||
    dictionaryToLines(project.narrator.pronunciationDictionary) !== payload.pronunciationLines;

  project.title = payload.title.trim();
  project.author = payload.author.trim();
  project.description = payload.description.trim();
  project.narrator = {
    ...project.narrator,
    name: payload.narratorName.trim(),
    voice: payload.voice,
    defaultPace: payload.defaultPace,
    defaultPauseMs: payload.defaultPauseMs,
    defaultDeliveryPreset: payload.defaultDeliveryPreset,
    pronunciationDictionary: parseDictionaryInput(payload.pronunciationLines),
  };

  if (voiceChanged || defaultsChanged) {
    clearAudio(project);
  }

  await saveProject(project);
  return project;
}

function parseReferenceTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function allowedReferenceAsset(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".mp3" || extension === ".wav" || extension === ".m4a";
}

const MAX_REFERENCE_ASSET_BYTES = 250 * 1024 * 1024;
const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

export async function uploadReferenceNarrationAsset(projectId: string, formData: FormData) {
  const project = await getProject(projectId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an audio file to upload.");
  }

  if (file.size > MAX_REFERENCE_ASSET_BYTES) {
    throw new Error("Reference narration uploads are limited to 250 MB.");
  }

  if (!allowedReferenceAsset(file.name)) {
    throw new Error("Reference narration uploads currently support mp3, wav, and m4a.");
  }

  const assetId = randomUUID();
  const extension = path.extname(file.name).toLowerCase();
  const safeBaseName = sanitizeFileSegment(path.basename(file.name, extension));
  const relativePath = path.posix.join(
    "assets",
    "reference-audio",
    `${assetId}-${safeBaseName || "reference-narration"}${extension}`,
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = extractAudioMetadata(buffer, file.name);
  const clientDuration = Number(formData.get("clientDurationSeconds"));

  await writeBufferFile(safeProjectPath(project.id, relativePath), buffer);

  const asset = normaliseReferenceAsset(project.id, {
    id: assetId,
    title: String(formData.get("title") ?? path.basename(file.name, extension)).trim() || path.basename(file.name, extension),
    originalFilename: file.name,
    filePath: relativePath,
    format: extracted.format ?? (extension.replace(".", "") || null),
    durationSeconds:
      extracted.durationSeconds ?? (Number.isFinite(clientDuration) && clientDuration > 0 ? clientDuration : null),
    sampleRateHz: extracted.sampleRateHz,
    channels: extracted.channels,
    bitrateKbps: extracted.bitrateKbps,
    notes: String(formData.get("notes") ?? "").trim(),
    assetType: normaliseReferenceAssetType(String(formData.get("assetType") ?? "style-reference")),
    analysis: {
      ...createReferenceAnalysis(),
      estimatedAveragePaceNote: String(formData.get("estimatedAveragePaceNote") ?? "").trim(),
      manualStyleSummary: String(formData.get("manualStyleSummary") ?? "").trim(),
      referenceTags: parseReferenceTags(String(formData.get("referenceTags") ?? "")),
    },
  });

  project.referenceNarrationAssets.push(asset);
  if (!project.primaryReferenceAssetId || formData.get("markPrimary") === "true") {
    project.primaryReferenceAssetId = asset.id;
    asset.assetType = "style-reference";
  }

  await saveProject(project);
  return project;
}

export async function updateReferenceNarrationAsset(
  projectId: string,
  payload: {
    assetId: string;
    title: string;
    notes: string;
    assetType: ReferenceNarrationAssetType;
    manualStyleSummary: string;
    estimatedAveragePaceNote: string;
    referenceTags: string[];
    markPrimaryStyleReference?: boolean;
  },
) {
  const project = await getProject(projectId);
  const asset = project.referenceNarrationAssets.find((item) => item.id === payload.assetId);
  if (!asset) {
    throw new Error("Reference narration asset not found.");
  }

  asset.title = payload.title.trim() || asset.title;
  asset.notes = payload.notes.trim();
  asset.assetType = normaliseReferenceAssetType(payload.assetType);
  asset.analysis = {
    ...asset.analysis,
    manualStyleSummary: payload.manualStyleSummary.trim(),
    estimatedAveragePaceNote: payload.estimatedAveragePaceNote.trim(),
    referenceTags: payload.referenceTags.map((item) => item.trim()).filter(Boolean),
  };

  if (payload.markPrimaryStyleReference) {
    project.primaryReferenceAssetId = asset.id;
    asset.assetType = "style-reference";
  } else if (
    project.primaryReferenceAssetId === asset.id &&
    payload.assetType !== "style-reference"
  ) {
    project.primaryReferenceAssetId = null;
  }

  await saveProject(project);
  return project;
}

async function readManuscriptFromUpload(formData: FormData) {
  const manuscriptText = String(formData.get("manuscriptText") ?? "");
  if (manuscriptText.trim()) {
    return manuscriptText;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return "";
  }

  const extension = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf8");
}

export async function parseProjectManuscript(projectId: string, formData: FormData) {
  const project = await getProject(projectId);
  const manuscriptText = await readManuscriptFromUpload(formData);
  project.manuscriptText = manuscriptText;
  project.chapters = parseManuscriptToChapters(
    manuscriptText,
    project.narrator.defaultPace,
    project.narrator.defaultPauseMs,
    project.narrator.defaultDeliveryPreset,
  );
  project.annotatedScript = {
    ...createEmptyAnnotatedScript(project.id),
    updatedAt: nowIso(),
    sourceManuscriptUpdatedAt: project.updatedAt,
    generationNotes: [
      "Generate a new annotated script after importing or changing the manuscript.",
      "Dialogue attribution remains approximate until you review it.",
    ],
  };
  clearAudio(project);
  await saveProject(project);
  return project;
}

export async function generateProjectAnnotatedScript(projectId: string) {
  const project = await getProject(projectId);
  project.annotatedScript = generateAnnotatedScript(project);
  await saveProject(project);
  return project;
}

export async function saveProjectAnnotatedScript(projectId: string, annotatedScript: AnnotatedScript) {
  const project = await getProject(projectId);
  project.annotatedScript = normaliseAnnotatedScript(projectId, {
    ...annotatedScript,
    projectId,
    updatedAt: nowIso(),
    sourceManuscriptUpdatedAt: project.updatedAt,
  });
  await saveProject(project);
  return project;
}

function estimateExpectedDurationSeconds(project: ProjectRecord, chapterId: string, lineId: string | null) {
  const chapter = project.annotatedScript.lines.filter((line) => line.chapterId === chapterId);
  const targetLines = lineId ? chapter.filter((line) => line.id === lineId) : chapter;
  const targetText = targetLines
    .filter((line) => line.lineType !== "sfx" && line.lineType !== "note")
    .map((line) => line.performanceText.trim())
    .join(" ");
  if (!targetText) {
    return null;
  }

  const wordCount = targetText.split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 138 * Math.max(project.narrator.defaultPace, 0.75);
  return Number(((wordCount / wordsPerMinute) * 60).toFixed(1));
}

export async function saveRecordingTake(
  projectId: string,
  payload: {
    chapterId: string;
    lineId: string | null;
    name: string;
    mimeType: string;
    notes: string;
    durationSeconds: number | null;
    peakLevel: number | null;
    rmsLevel: number | null;
    silenceDurationSeconds: number | null;
    buffer: Buffer;
  },
) {
  if (payload.buffer.byteLength > MAX_RECORDING_BYTES) {
    throw new Error("Booth recordings are limited to 500 MB per take.");
  }

  const project = await getProject(projectId);
  const chapter = locateChapter(project, payload.chapterId);
  const relatedLine =
    payload.lineId ? project.annotatedScript.lines.find((line) => line.id === payload.lineId) ?? null : null;
  const extension =
    payload.mimeType.includes("webm")
      ? ".webm"
      : payload.mimeType.includes("mp4") || payload.mimeType.includes("m4a")
        ? ".m4a"
        : payload.mimeType.includes("mpeg")
          ? ".mp3"
          : ".wav";
  const relativePath = path.posix.join(
    "recordings",
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${sanitizeFileSegment(payload.name || chapter.title)}${extension}`,
  );
  await writeBufferFile(safeProjectPath(project.id, relativePath), payload.buffer);

  const expectedDurationSeconds = estimateExpectedDurationSeconds(project, chapter.id, payload.lineId);
  const pacingDeltaSeconds =
    expectedDurationSeconds !== null && payload.durationSeconds !== null
      ? Number((payload.durationSeconds - expectedDurationSeconds).toFixed(1))
      : null;

  const take: RecordingTake = {
    id: randomUUID(),
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    lineId: payload.lineId,
    lineOrder: relatedLine?.lineOrder ?? null,
    name: payload.name.trim() || `${chapter.title} take ${project.recordingWorkspace.takes.length + 1}`,
    filePath: relativePath,
    mimeType: payload.mimeType || "audio/webm",
    durationSeconds: payload.durationSeconds,
    peakLevel: payload.peakLevel,
    rmsLevel: payload.rmsLevel,
    silenceDurationSeconds: payload.silenceDurationSeconds,
    recordedAt: nowIso(),
    notes: payload.notes.trim(),
    feedback: {
      expectedDurationSeconds,
      pacingDeltaSeconds,
      pacingNote:
        pacingDeltaSeconds === null
          ? "Estimated pacing unavailable."
          : Math.abs(pacingDeltaSeconds) <= 2
            ? "Close to the estimated pacing."
            : pacingDeltaSeconds > 0
              ? "Longer than the estimated pacing. This may be intentional."
              : "Shorter than the estimated pacing. Check clarity on the read.",
      silenceTooLong: (payload.silenceDurationSeconds ?? 0) >= 2.5,
      clippingRisk:
        (payload.peakLevel ?? 0) >= 0.97 ? "high" : (payload.peakLevel ?? 0) >= 0.9 ? "medium" : "low",
      lowVolumeWarning: (payload.rmsLevel ?? 0) > 0 && (payload.rmsLevel ?? 0) < 0.035,
      noiseWarning: (payload.rmsLevel ?? 0) > 0.14 && (payload.peakLevel ?? 0) < 0.55,
    },
  };

  project.recordingWorkspace.takes.unshift(take);
  await saveProject(project);
  return project;
}

function locateChapter(project: ProjectRecord, chapterId: string) {
  const chapter = project.chapters.find((item) => item.id === chapterId);
  if (!chapter) {
    throw new Error("Chapter not found");
  }
  return chapter;
}

function locateSentence(chapter: ChapterItem, sentenceId: string) {
  const sentence = chapter.sentences.find((item) => item.id === sentenceId);
  if (!sentence) {
    throw new Error("Sentence not found");
  }
  return sentence;
}

export async function saveSentence(
  projectId: string,
  payload: {
    chapterId: string;
    sentenceId: string;
    text: string;
    pace: number;
    pauseMs: number;
    deliveryPreset: SentenceItem["deliveryPreset"];
    pronunciationLines: string;
  },
) {
  const project = await getProject(projectId);
  const chapter = locateChapter(project, payload.chapterId);
  const sentence = locateSentence(chapter, payload.sentenceId);
  sentence.text = payload.text;
  sentence.originalText = payload.text;
  sentence.pace = payload.pace;
  sentence.pauseMs = payload.pauseMs;
  sentence.deliveryPreset = payload.deliveryPreset;
  sentence.pronunciationOverrides = parseDictionaryInput(payload.pronunciationLines);
  sentence.audioPath = null;
  chapter.previewAudioPath = null;
  project.exportStatus.lastBundleExportAt = null;
  project.exportStatus.lastChapterExportAt = null;
  await saveProject(project);
  return project;
}

async function ensureSentenceAudio(project: ProjectRecord, chapter: ChapterItem, sentence: SentenceItem) {
  const relativePath = sentence.sfxTag
    ? path.posix.join("assets", `${sanitizeFileSegment(sentence.sfxTag)}.wav`)
    : path.posix.join("audio", "sentences", `${sentence.id}.wav`);
  const outputPath = safeProjectPath(project.id, relativePath);

  if (sentence.sfxTag) {
    if (!(await pathExists(outputPath))) {
      await writeBufferFile(outputPath, createSfxWav(sentence.sfxTag));
    }
    sentence.audioPath = relativePath;
    return relativePath;
  }

  if (!sentence.text.trim()) {
    throw new Error("Sentence text is empty");
  }

  await synthesizeToWav({
    text: sentence.text,
    voice: project.narrator.voice,
    pace: sentence.pace,
    pauseMs: sentence.pauseMs,
    preset: sentence.deliveryPreset,
    pronunciationDictionary: {
      ...project.narrator.pronunciationDictionary,
      ...sentence.pronunciationOverrides,
    },
    outputPath,
  });

  sentence.audioPath = relativePath;
  chapter.previewAudioPath = null;
  return relativePath;
}

export async function generateSentence(
  projectId: string,
  payload: {
    chapterId: string;
    sentenceId: string;
    text: string;
    pace: number;
    pauseMs: number;
    deliveryPreset: SentenceItem["deliveryPreset"];
    pronunciationLines: string;
  },
) {
  const project = await getProject(projectId);
  const chapter = locateChapter(project, payload.chapterId);
  const sentence = locateSentence(chapter, payload.sentenceId);
  sentence.text = payload.text;
  sentence.originalText = payload.text;
  sentence.pace = payload.pace;
  sentence.pauseMs = payload.pauseMs;
  sentence.deliveryPreset = payload.deliveryPreset;
  sentence.pronunciationOverrides = parseDictionaryInput(payload.pronunciationLines);
  await ensureSentenceAudio(project, chapter, sentence);
  await saveProject(project);
  return project;
}

export async function generateChapter(projectId: string, chapterId: string) {
  const project = await getProject(projectId);
  const chapter = locateChapter(project, chapterId);
  const clips: Buffer[] = [];

  for (const sentence of chapter.sentences) {
    if (!sentence.text.trim() && !sentence.sfxTag) {
      continue;
    }

    const clipPath = await ensureSentenceAudio(project, chapter, sentence);
    clips.push(await readFile(safeProjectPath(project.id, clipPath)));

    if (!sentence.sfxTag) {
      clips.push(createSilenceWav(sentence.pauseMs));
    }
  }

  if (clips.length === 0) {
    throw new Error("This chapter has no generated audio yet.");
  }

  const relativePath = path.posix.join("audio", "chapters", `${chapter.id}.wav`);
  await writeBufferFile(safeProjectPath(project.id, relativePath), concatWavFiles(clips));
  chapter.previewAudioPath = relativePath;
  await saveProject(project);
  return project;
}

export async function buildExport(projectId: string, chapterId?: string) {
  const project = await getProject(projectId);

  if (chapterId) {
    const chapter = locateChapter(project, chapterId);
    if (!chapter.previewAudioPath) {
      await generateChapter(projectId, chapterId);
    }

    const refreshed = await getProject(projectId);
    const latestChapter = locateChapter(refreshed, chapterId);
    if (!latestChapter.previewAudioPath) {
      throw new Error("Chapter export could not be created.");
    }

    refreshed.exportStatus.lastChapterExportAt = nowIso();
    await saveProject(refreshed);
    return {
      fileName: `${sanitizeFileSegment(refreshed.title)}-${sanitizeFileSegment(latestChapter.title)}.wav`,
      filePath: safeProjectPath(refreshed.id, latestChapter.previewAudioPath),
      contentType: "audio/wav",
    };
  }

  const zip = new JSZip();

  for (const chapter of project.chapters) {
    if (!chapter.previewAudioPath) {
      await generateChapter(projectId, chapter.id);
    }
  }

  const finalProject = await getProject(projectId);

  for (const chapter of finalProject.chapters) {
    if (!chapter.previewAudioPath) {
      continue;
    }

    const chapterBuffer = await readFile(safeProjectPath(finalProject.id, chapter.previewAudioPath));
    zip.file(
      `${String(chapter.index + 1).padStart(2, "0")}-${sanitizeFileSegment(chapter.title)}.wav`,
      chapterBuffer,
    );
  }

  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        title: finalProject.title,
        author: finalProject.author,
        exportedAt: nowIso(),
        narrator: finalProject.narrator,
        chapters: finalProject.chapters.map((chapter) => ({
          title: chapter.title,
          sentences: chapter.sentences.length,
        })),
      },
      null,
      2,
    ),
  );

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const bundlePath = safeProjectPath(
    finalProject.id,
    path.posix.join("exports", `${sanitizeFileSegment(finalProject.title)}-chapters.zip`),
  );
  await writeBufferFile(bundlePath, zipBuffer);
  finalProject.exportStatus.lastBundleExportAt = nowIso();
  await saveProject(finalProject);

  return {
    fileName: path.basename(bundlePath),
    filePath: bundlePath,
    contentType: "application/zip",
  };
}
