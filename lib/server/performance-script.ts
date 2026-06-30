import { randomUUID } from "node:crypto";

import type {
  AnnotatedScript,
  ChapterItem,
  PerformanceCue,
  ProjectRecord,
  ScriptLine,
  SpeakerProfile,
} from "@/lib/shared/types";

const SPEAKER_COLORS = [
  "#d88f5a",
  "#7ec7b8",
  "#c6a1ff",
  "#f0c66b",
  "#6fb4ff",
  "#ef8fb1",
  "#9fd16f",
  "#b9a284",
];

const SPEECH_VERBS = [
  "said",
  "asked",
  "replied",
  "whispered",
  "murmured",
  "shouted",
  "called",
  "cried",
  "answered",
  "added",
  "snapped",
  "sighed",
];

function nowIso() {
  return new Date().toISOString();
}

function createCue(
  type: PerformanceCue["type"],
  label: string,
  note: string,
  intensity: PerformanceCue["intensity"] = "light",
  isManual = false,
): PerformanceCue {
  return {
    id: randomUUID(),
    type,
    label,
    note,
    intensity,
    isManual,
  };
}

export function createEmptyAnnotatedScript(projectId: string): AnnotatedScript {
  const timestamp = nowIso();
  return {
    id: randomUUID(),
    projectId,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceManuscriptUpdatedAt: null,
    generationMethod: "rules-based",
    generationNotes: [
      "Performance Script Mode uses rules-based markup. Dialogue attribution is approximate and should be reviewed.",
      "Unknown speaker labels are intentional when ChipVoice Studio cannot confidently infer a recurring voice.",
    ],
    speakerProfiles: [
      {
        id: "narrator",
        name: "Narrator",
        color: "#c9b08c",
        voiceNote: "Primary read-aloud voice for descriptive passages.",
        pronunciationNotes: [],
        deliveryNote: "",
        genericVoiceAssignment: null,
        detectionSource: "system",
      },
      {
        id: "unknown-speaker",
        name: "Unknown speaker",
        color: "#8b8a86",
        voiceNote: "Manual assignment recommended when attribution is unclear.",
        pronunciationNotes: [],
        deliveryNote: "",
        genericVoiceAssignment: null,
        detectionSource: "system",
      },
    ],
    lines: [],
  };
}

export function createEmptyRecordingWorkspace() {
  return {
    takes: [],
  };
}

function normalizeName(name: string) {
  return name.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").trim();
}

function extractSpeakerName(segment: string) {
  const cleaned = normalizeName(segment);
  if (!cleaned) {
    return null;
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const capitalized = tokens.filter((token) => /^[A-Z][a-z'-]+$/.test(token));
  if (capitalized.length === 0 || capitalized.length > 3) {
    return null;
  }

  return capitalized.join(" ");
}

function detectSpeakerName(text: string) {
  const dialogueBeforeVerb = new RegExp(`(?:^|["'])\\s*([A-Z][A-Za-z' -]{1,40})\\s+(?:${SPEECH_VERBS.join("|")})\\b`);
  const verbBeforeDialogue = new RegExp(`(?:${SPEECH_VERBS.join("|")})\\s+([A-Z][A-Za-z' -]{1,40})(?:[,.]|\\s|$)`);

  const directBefore = text.match(dialogueBeforeVerb)?.[1];
  const directAfter = text.match(verbBeforeDialogue)?.[1];

  return extractSpeakerName(directBefore ?? directAfter ?? "");
}

function collectPronunciationNotes(text: string, project: ProjectRecord, speaker: SpeakerProfile | null) {
  const notes = new Set<string>();
  const loweredText = text.toLowerCase();

  for (const [term, spoken] of Object.entries(project.narrator.pronunciationDictionary)) {
    if (loweredText.includes(term.toLowerCase())) {
      notes.add(`${term} -> ${spoken}`);
    }
  }

  for (const note of speaker?.pronunciationNotes ?? []) {
    if (note.trim()) {
      notes.add(note.trim());
    }
  }

  return Array.from(notes);
}

function buildDialogueCues(text: string) {
  const cues: PerformanceCue[] = [];

  if (/[!?]{1,}/.test(text)) {
    cues.push(createCue("emphasis", "Lift emphasis", "Dialogue carries extra energy or urgency.", "medium"));
  }

  if (/\.{3}|—|--/.test(text)) {
    cues.push(createCue("pause", "Hold the beat", "Leave a slightly longer pause through the interruption.", "medium"));
  }

  return cues;
}

function derivePacingNote(text: string, lineType: ScriptLine["lineType"]) {
  if (lineType === "sfx") {
    return "Cue only";
  }
  if (/\.{3}|—|--/.test(text)) {
    return "Slow down through the turn";
  }
  if (text.length > 180) {
    return "Unhurried read";
  }
  if (/[!?]{1,}/.test(text)) {
    return "Slightly brighter pace";
  }
  return lineType === "dialogue" ? "Conversational pace" : "Steady narrative pace";
}

function deriveEmphasisNote(text: string) {
  const emphasized = text.match(/\b([A-Z]{2,}|never|always|must|now|wait)\b/);
  return emphasized ? `Lean on "${emphasized[1]}"` : "";
}

function inferSectionLabel(chapter: ChapterItem, lineIndex: number) {
  if (lineIndex === 0) {
    return `Chapter ${chapter.index + 1} opening`;
  }
  if (lineIndex > 0 && lineIndex % 18 === 0) {
    return `Chapter ${chapter.index + 1} mid-section`;
  }
  return null;
}

function splitDialogueSegments(text: string) {
  const segments: Array<{ type: "narration" | "dialogue"; text: string }> = [];
  const quotes = text.match(/"[^"]+"|'[^']+'/g);

  if (!quotes) {
    return [{ type: "narration" as const, text }];
  }

  let cursor = 0;
  for (const quote of quotes) {
    const index = text.indexOf(quote, cursor);
    if (index > cursor) {
      const before = text.slice(cursor, index).trim();
      if (before) {
        segments.push({ type: "narration", text: before });
      }
    }

    segments.push({ type: "dialogue", text: quote.replace(/^['"]|['"]$/g, "").trim() });
    cursor = index + quote.length;
  }

  if (cursor < text.length) {
    const after = text.slice(cursor).trim();
    if (after) {
      segments.push({ type: "narration", text: after });
    }
  }

  return segments.length > 0 ? segments : [{ type: "narration" as const, text }];
}

function ensureSpeakerProfile(
  speakerProfiles: SpeakerProfile[],
  speakerName: string | null,
) {
  if (!speakerName) {
    return speakerProfiles.find((profile) => profile.id === "unknown-speaker") ?? null;
  }

  const existing = speakerProfiles.find(
    (profile) => profile.name.toLowerCase() === speakerName.toLowerCase(),
  );
  if (existing) {
    return existing;
  }

  const profile: SpeakerProfile = {
    id: randomUUID(),
    name: speakerName,
    color: SPEAKER_COLORS[(speakerProfiles.length - 2) % SPEAKER_COLORS.length] ?? "#c9b08c",
    voiceNote: "",
    pronunciationNotes: [],
    deliveryNote: "Add a brief delivery reminder if this character needs a distinct feel.",
    genericVoiceAssignment: null,
    detectionSource: "generated",
  };
  speakerProfiles.push(profile);
  return profile;
}

export function generateAnnotatedScript(project: ProjectRecord) {
  const base = createEmptyAnnotatedScript(project.id);
  const lines: ScriptLine[] = [];
  const speakerProfiles = [...base.speakerProfiles];
  let lineOrder = 0;

  for (const chapter of project.chapters) {
    lines.push({
      id: randomUUID(),
      chapterId: chapter.id,
      chapterIndex: chapter.index,
      lineOrder,
      lineType: "note",
      originalText: chapter.title,
      performanceText: chapter.title,
      speakerProfileId: null,
      colorTag: "#c9b08c",
      pronunciationNotes: [],
      pacingNote: "Reset breath before the chapter opening.",
      cueMarkers: [createCue("chapter-transition", "Chapter transition", "Give the new chapter a clear reset.", "strong")],
      emphasisNote: "",
      performanceNote: "Chapter heading",
      sectionLabel: `Chapter ${chapter.index + 1}`,
    });
    lineOrder += 1;

    for (const [sentenceIndex, sentence] of chapter.sentences.entries()) {
      if (sentence.sfxTag) {
        lines.push({
          id: randomUUID(),
          chapterId: chapter.id,
          chapterIndex: chapter.index,
          lineOrder,
          lineType: "sfx",
          originalText: `[sfx: ${sentence.sfxTag}]`,
          performanceText: `[sfx: ${sentence.sfxTag}]`,
          speakerProfileId: null,
          colorTag: "#8b8a86",
          pronunciationNotes: [],
          pacingNote: "Cue only",
          cueMarkers: [createCue("sfx-ahead", "SFX cue ahead", "There is an explicit manuscript sound cue here.", "medium")],
          emphasisNote: "",
          performanceNote: "",
          sectionLabel: inferSectionLabel(chapter, sentenceIndex),
        });
        lineOrder += 1;
        continue;
      }

      for (const segment of splitDialogueSegments(sentence.text)) {
        const speaker =
          segment.type === "dialogue"
            ? ensureSpeakerProfile(speakerProfiles, detectSpeakerName(sentence.originalText))
            : speakerProfiles.find((profile) => profile.id === "narrator") ?? null;

        const baseCues = segment.type === "dialogue" ? buildDialogueCues(segment.text) : [];
        if (sentence.pauseMs >= 600) {
          baseCues.push(createCue("pause", "Longer pause", `${sentence.pauseMs} ms pause suggested after this line.`, "medium"));
        }
        if (sentence.deliveryPreset === "dramatic") {
          baseCues.push(createCue("tone", "Lean into tone", "Current delivery preset is dramatic.", "medium"));
        }

        lines.push({
          id: randomUUID(),
          chapterId: chapter.id,
          chapterIndex: chapter.index,
          lineOrder,
          lineType: segment.type,
          originalText: segment.text,
          performanceText: segment.text,
          speakerProfileId: speaker?.id ?? null,
          colorTag: speaker?.color ?? null,
          pronunciationNotes: collectPronunciationNotes(segment.text, project, speaker),
          pacingNote: derivePacingNote(segment.text, segment.type),
          cueMarkers: baseCues,
          emphasisNote: deriveEmphasisNote(segment.text),
          performanceNote:
            segment.type === "dialogue" && speaker?.id === "unknown-speaker"
              ? "Speaker attribution is approximate. Manual review recommended."
              : speaker?.deliveryNote ?? "",
          sectionLabel: inferSectionLabel(chapter, sentenceIndex),
        });
        lineOrder += 1;
      }
    }
  }

  return {
    ...base,
    sourceManuscriptUpdatedAt: project.updatedAt,
    updatedAt: nowIso(),
    speakerProfiles,
    lines,
  };
}

