import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const dbPath = path.join(cwd, "data", "chipvoice-db.json");

const now = new Date().toISOString();

function baseSettings() {
  return {
    appName: "ChipVoice Studio",
    defaultProvider: "mock",
    providerApiKey: "",
    localTtsServerUrl: "http://127.0.0.1:8020",
    localTtsServerToken: "",
    defaultStyle: "Warm, intimate audiobook narration with measured pacing.",
    defaultSpeed: 1,
    defaultPauseMs: 300,
    narratorGuidance:
      "Use only your own voice, or a voice you have explicit rights to use.",
  };
}

function makeVoiceProfile(id, projectId, name, sampleCount = 3) {
  return {
    id,
    projectId,
    provider: "mock",
    providerVoiceId: `mock-${id}`,
    name,
    status: "ready",
    sampleCount,
    notes: "Recorded in a treated study with close-mic narration.",
    estimatedQuality: "Even tone, quiet room, strong diction.",
    createdAt: now,
  };
}

function makeSamples(voiceProfileId, stem) {
  return [1, 2, 3].map((index) => ({
    id: `${voiceProfileId}-sample-${index}`,
    voiceProfileId,
    filename: `${stem}-${index}.wav`,
    duration: 18 + index * 3,
    storagePath: `/uploads/${voiceProfileId}/${stem}-${index}.wav`,
    qualityStatus: "good",
    transcriptOptional: "",
  }));
}

function makeSentence(id, chapterId, orderIndex, text, extra = {}) {
  return {
    id,
    chapterId,
    orderIndex,
    originalText: text,
    narrationText: text,
    generatedAudioPath: null,
    duration: 0,
    stylePrompt: "",
    pronunciationOverride: "",
    pauseAfterMs: 280,
    speed: 1,
    generationStatus: "idle",
    ...extra,
  };
}

function mainDatabase() {
  const quietProject = {
    id: "project-quiet-lantern",
    title: "The Quiet Lantern",
    author: "Eliza Wren",
    description:
      "A hush-filled literary mystery set in a rain-soaked boarding house.",
    voiceProfileId: "voice-quiet-lantern",
    createdAt: now,
    updatedAt: now,
    manuscriptStatus: "imported",
    exportStatus: "idle",
  };

  const tideglassProject = {
    id: "project-tideglass-letters",
    title: "Tideglass Letters",
    author: "Mara Sol",
    description:
      "An epistolary coastal drama with a slower, more intimate narration rhythm.",
    voiceProfileId: "voice-tideglass",
    createdAt: now,
    updatedAt: now,
    manuscriptStatus: "imported",
    exportStatus: "idle",
  };

  const orchardProject = {
    id: "project-orchard-ashes",
    title: "Orchard Ashes",
    author: "Jon Vale",
    description:
      "A new draft project with no voice profile attached yet.",
    voiceProfileId: null,
    createdAt: now,
    updatedAt: now,
    manuscriptStatus: "empty",
    exportStatus: "idle",
  };

  const quietChapters = [
    {
      id: "chapter-quiet-1",
      projectId: quietProject.id,
      orderIndex: 0,
      title: "Chapter One",
      rawText:
        "Rain worried the panes all evening. The lantern clicked once before settling into a low amber pulse.\n\nMina lifted the envelope and heard the paper whisper in her hand.",
      narrationText:
        "Rain worried the panes all evening. The lantern clicked once before settling into a low amber pulse.\n\nMina lifted the envelope and heard the paper whisper in her hand.",
      status: "parsed",
      previewAudioPath: null,
      previewDuration: 0,
    },
    {
      id: "chapter-quiet-2",
      projectId: quietProject.id,
      orderIndex: 1,
      title: "Chapter Two",
      rawText:
        "A knock arrived at dawn. Footsteps crossed the narrow hall before the latch turned.",
      narrationText:
        "A knock arrived at dawn. Footsteps crossed the narrow hall before the latch turned.",
      status: "parsed",
      previewAudioPath: null,
      previewDuration: 0,
    },
  ];

  const tideglassChapters = [
    {
      id: "chapter-tideglass-1",
      projectId: tideglassProject.id,
      orderIndex: 0,
      title: "Letter I",
      rawText:
        "The tide had already climbed the pier by the time I began this letter. Gulls turned above the roofs and the kettle hummed in the kitchen.",
      narrationText:
        "The tide had already climbed the pier by the time I began this letter. Gulls turned above the roofs and the kettle hummed in the kitchen.",
      status: "generating",
      previewAudioPath: null,
      previewDuration: 0,
    },
  ];

  const quietSentences = [
    makeSentence("quiet-s1", "chapter-quiet-1", 0, "Rain worried the panes all evening."),
    makeSentence(
      "quiet-s2",
      "chapter-quiet-1",
      1,
      "The lantern clicked once before settling into a low amber pulse.",
      { stylePrompt: "Quietly suspenseful." },
    ),
    makeSentence(
      "quiet-s3",
      "chapter-quiet-1",
      2,
      "Mina lifted the envelope and heard the paper whisper in her hand.",
      { pronunciationOverride: "Mina=MEE-na" },
    ),
    makeSentence("quiet-s4", "chapter-quiet-2", 0, "A knock arrived at dawn."),
    makeSentence(
      "quiet-s5",
      "chapter-quiet-2",
      1,
      "Footsteps crossed the narrow hall before the latch turned.",
      { stylePrompt: "Measured and tense." },
    ),
  ];

  const tideglassSentences = [
    makeSentence(
      "tide-s1",
      "chapter-tideglass-1",
      0,
      "The tide had already climbed the pier by the time I began this letter.",
      { generationStatus: "generating" },
    ),
    makeSentence(
      "tide-s2",
      "chapter-tideglass-1",
      1,
      "Gulls turned above the roofs and the kettle hummed in the kitchen.",
      { generationStatus: "generating" },
    ),
  ];

  return {
    projects: [quietProject, tideglassProject, orchardProject],
    voiceProfiles: [
      makeVoiceProfile("voice-quiet-lantern", quietProject.id, "Eliza Warm Narration"),
      makeVoiceProfile("voice-tideglass", tideglassProject.id, "Mara Close Letter Read"),
    ],
    voiceSamples: [
      ...makeSamples("voice-quiet-lantern", "eliza"),
      ...makeSamples("voice-tideglass", "mara"),
    ],
    chapters: [...quietChapters, ...tideglassChapters],
    sentences: [...quietSentences, ...tideglassSentences],
    pronunciationEntries: [
      {
        id: "pron-quiet-1",
        projectId: quietProject.id,
        sourceTerm: "Mina",
        replacementTerm: "MEE-na",
        notes: "Preferred house pronunciation.",
      },
    ],
    sfxSuggestions: [
      {
        id: "sfx-quiet-rain",
        projectId: quietProject.id,
        chapterId: "chapter-quiet-1",
        sentenceId: "quiet-s1",
        label: "Rain ambience",
        cue: "rain",
        reason: "The opening line clearly establishes rain on the windows.",
        placement: "under",
        intensity: 0.28,
        startOffsetMs: 0,
        status: "suggested",
        generatedAudioPath: null,
      },
      {
        id: "sfx-quiet-paper",
        projectId: quietProject.id,
        chapterId: "chapter-quiet-1",
        sentenceId: "quiet-s3",
        label: "Paper rustle",
        cue: "paper",
        reason: "The envelope handling moment reads like a tactile cue.",
        placement: "before",
        intensity: 0.36,
        startOffsetMs: -80,
        status: "suggested",
        generatedAudioPath: null,
      },
      {
        id: "sfx-quiet-knock",
        projectId: quietProject.id,
        chapterId: "chapter-quiet-2",
        sentenceId: "quiet-s4",
        label: "Door knock",
        cue: "door-knock",
        reason: "The line explicitly introduces a knock.",
        placement: "before",
        intensity: 0.85,
        startOffsetMs: -120,
        status: "suggested",
        generatedAudioPath: null,
      },
      {
        id: "sfx-tide-kettle",
        projectId: tideglassProject.id,
        chapterId: "chapter-tideglass-1",
        sentenceId: "tide-s2",
        label: "Kettle room tone",
        cue: "kettle",
        reason: "The line mentions the kettle directly.",
        placement: "under",
        intensity: 0.24,
        startOffsetMs: 0,
        status: "suggested",
        generatedAudioPath: null,
      },
    ],
    exportJobs: [],
    settings: baseSettings(),
  };
}

function emptyDatabase() {
  return {
    projects: [],
    voiceProfiles: [],
    voiceSamples: [],
    chapters: [],
    sentences: [],
    pronunciationEntries: [],
    sfxSuggestions: [],
    exportJobs: [],
    settings: baseSettings(),
  };
}

async function writeDb(data) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function prepareMainArtifacts() {
  await postJson("http://localhost:3000/api/projects/project-quiet-lantern/generate", {
    mode: "chapter",
    chapterId: "chapter-quiet-1",
  });
  await postJson("http://localhost:3000/api/projects/project-quiet-lantern/generate", {
    mode: "chapter",
    chapterId: "chapter-quiet-2",
  });

  await postJson("http://localhost:3000/api/projects/project-quiet-lantern/sfx", {
    action: "update",
    suggestionId: "sfx-quiet-rain",
    status: "applied",
    placement: "under",
    intensity: 0.28,
  });
  await postJson("http://localhost:3000/api/projects/project-quiet-lantern/sfx", {
    action: "update",
    suggestionId: "sfx-quiet-paper",
    status: "applied",
    placement: "before",
    intensity: 0.36,
  });

  await postJson("http://localhost:3000/api/projects/project-quiet-lantern/export", {
    format: "wav",
  });
}

const variant = process.argv[2] || "main";

if (variant === "empty") {
  await writeDb(emptyDatabase());
  console.log("Seeded empty UI database.");
} else if (variant === "main") {
  await writeDb(mainDatabase());
  await prepareMainArtifacts();
  console.log("Seeded main UI database.");
} else {
  throw new Error(`Unknown seed variant: ${variant}`);
}
