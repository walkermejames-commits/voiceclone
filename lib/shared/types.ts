export type DeliveryPreset = "neutral" | "warm" | "solemn" | "brisk" | "dramatic";

export type ProjectStatus = "empty" | "ready" | "in-progress";
export type ScriptLineType = "narration" | "dialogue" | "sfx" | "note";
export type PerformanceCueType =
  | "slow-down"
  | "pause"
  | "new-character"
  | "soften-tone"
  | "emphasis"
  | "sfx-ahead"
  | "chapter-transition"
  | "scene-transition"
  | "tone";

export type ReferenceNarrationAssetType =
  | "style-reference"
  | "pronunciation-reference"
  | "pacing-reference"
  | "demo-narration"
  | "archival-audio";

export interface ReferenceNarrationAnalysis {
  estimatedAveragePaceNote: string;
  manualStyleSummary: string;
  referenceTags: string[];
  placeholders: {
    pausePatternAnalysis: null;
    speakingRateEstimation: null;
    pronunciationComparison: null;
    deliveryStyleNotes: null;
  };
}

export interface ReferenceNarrationAsset {
  id: string;
  projectId: string;
  title: string;
  originalFilename: string;
  filePath: string;
  format: string | null;
  durationSeconds: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  bitrateKbps: number | null;
  notes: string;
  assetType: ReferenceNarrationAssetType;
  uploadedAt: string;
  analysis: ReferenceNarrationAnalysis;
}

export interface NarratorProfile {
  name: string;
  provider: string;
  voice: string;
  defaultPace: number;
  defaultPauseMs: number;
  defaultDeliveryPreset: DeliveryPreset;
  pronunciationDictionary: Record<string, string>;
}

export interface SentenceItem {
  id: string;
  index: number;
  text: string;
  originalText: string;
  pace: number;
  pauseMs: number;
  deliveryPreset: DeliveryPreset;
  pronunciationOverrides: Record<string, string>;
  sfxTag: string | null;
  audioPath: string | null;
}

export interface ChapterItem {
  id: string;
  index: number;
  title: string;
  sentences: SentenceItem[];
  previewAudioPath: string | null;
}

export interface PerformanceCue {
  id: string;
  type: PerformanceCueType;
  label: string;
  note: string;
  intensity: "light" | "medium" | "strong";
  isManual: boolean;
}

export interface SpeakerProfile {
  id: string;
  name: string;
  color: string;
  voiceNote: string;
  pronunciationNotes: string[];
  deliveryNote: string;
  genericVoiceAssignment: string | null;
  detectionSource: "generated" | "manual" | "system";
}

export interface ScriptLine {
  id: string;
  chapterId: string;
  chapterIndex: number;
  lineOrder: number;
  lineType: ScriptLineType;
  originalText: string;
  performanceText: string;
  speakerProfileId: string | null;
  colorTag: string | null;
  pronunciationNotes: string[];
  pacingNote: string;
  cueMarkers: PerformanceCue[];
  emphasisNote: string;
  performanceNote: string;
  sectionLabel: string | null;
}

export interface AnnotatedScript {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  sourceManuscriptUpdatedAt: string | null;
  generationMethod: "rules-based";
  generationNotes: string[];
  speakerProfiles: SpeakerProfile[];
  lines: ScriptLine[];
}

export interface RecordingFeedback {
  expectedDurationSeconds: number | null;
  pacingDeltaSeconds: number | null;
  pacingNote: string;
  silenceTooLong: boolean;
  clippingRisk: "low" | "medium" | "high";
  lowVolumeWarning: boolean;
  noiseWarning: boolean;
}

export interface RecordingTake {
  id: string;
  chapterId: string;
  chapterTitle: string;
  lineId: string | null;
  lineOrder: number | null;
  name: string;
  filePath: string;
  mimeType: string;
  durationSeconds: number | null;
  peakLevel: number | null;
  rmsLevel: number | null;
  silenceDurationSeconds: number | null;
  recordedAt: string;
  notes: string;
  feedback: RecordingFeedback;
}

export interface RecordingWorkspace {
  takes: RecordingTake[];
}

export interface ProjectRecord {
  id: string;
  title: string;
  author: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  manuscriptText: string;
  narrator: NarratorProfile;
  chapters: ChapterItem[];
  referenceNarrationAssets: ReferenceNarrationAsset[];
  primaryReferenceAssetId: string | null;
  annotatedScript: AnnotatedScript;
  recordingWorkspace: RecordingWorkspace;
  generationStatus: {
    state: ProjectStatus;
    generatedSentences: number;
    totalSentences: number;
    generatedChapters: number;
    totalChapters: number;
  };
  exportStatus: {
    lastChapterExportAt: string | null;
    lastBundleExportAt: string | null;
  };
}

export interface ProjectSummary {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
  chapterCount: number;
  generatedSentences: number;
  totalSentences: number;
  generatedChapters: number;
  totalChapters: number;
}
