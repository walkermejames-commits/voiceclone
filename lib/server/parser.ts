import { randomUUID } from "node:crypto";

import type { ChapterItem, DeliveryPreset, SentenceItem } from "@/lib/shared/types";

const CHAPTER_HEADING_PATTERN =
  /^(#{1,6}\s+.+|chapter\s+[\divxlcdm]+.*|prologue|epilogue)$/i;
const SFX_PATTERN = /\[sfx:\s*([^\]]+?)\s*\]/gi;

function normalizeText(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

function splitPlainSentences(block: string) {
  const compact = block.replace(/\s+/g, " ").trim();
  if (!compact) {
    return [];
  }

  const sentences: string[] = [];
  let current = "";

  for (let index = 0; index < compact.length; index += 1) {
    const char = compact[index];
    const next = compact[index + 1] ?? "";
    current += char;

    const boundary =
      /[.!?]/.test(char) &&
      (next === "" || /\s/.test(next) || /["')\]]/.test(next));

    if (boundary) {
      const sentence = current.trim();
      if (sentence) {
        sentences.push(sentence);
      }
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) {
    sentences.push(tail);
  }

  return sentences.length > 0 ? sentences : [compact];
}

function buildSentence(
  text: string,
  index: number,
  defaultPace: number,
  defaultPauseMs: number,
  defaultPreset: DeliveryPreset,
  sfxTag: string | null = null,
): SentenceItem {
  const source = sfxTag ? `[sfx: ${sfxTag}]` : text.trim();
  return {
    id: randomUUID(),
    index,
    text: source,
    originalText: source,
    pace: defaultPace,
    pauseMs: defaultPauseMs,
    deliveryPreset: defaultPreset,
    pronunciationOverrides: {},
    sfxTag,
    audioPath: null,
  };
}

function parseBlock(
  block: string,
  sentenceIndex: { value: number },
  defaultPace: number,
  defaultPauseMs: number,
  defaultPreset: DeliveryPreset,
) {
  const items: SentenceItem[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const text = block.trim();

  while ((match = SFX_PATTERN.exec(text))) {
    const before = text.slice(cursor, match.index).trim();
    for (const sentence of splitPlainSentences(before)) {
      items.push(
        buildSentence(
          sentence,
          sentenceIndex.value,
          defaultPace,
          defaultPauseMs,
          defaultPreset,
        ),
      );
      sentenceIndex.value += 1;
    }

    items.push(
      buildSentence(
        "",
        sentenceIndex.value,
        defaultPace,
        defaultPauseMs,
        defaultPreset,
        match[1].trim().toLowerCase(),
      ),
    );
    sentenceIndex.value += 1;
    cursor = match.index + match[0].length;
  }

  const after = text.slice(cursor).trim();
  for (const sentence of splitPlainSentences(after)) {
    items.push(
      buildSentence(
        sentence,
        sentenceIndex.value,
        defaultPace,
        defaultPauseMs,
        defaultPreset,
      ),
    );
    sentenceIndex.value += 1;
  }

  return items;
}

export function parseManuscriptToChapters(
  manuscriptText: string,
  defaultPace: number,
  defaultPauseMs: number,
  defaultPreset: DeliveryPreset,
): ChapterItem[] {
  const normalized = normalizeText(manuscriptText);
  if (!normalized) {
    return [
      {
        id: randomUUID(),
        index: 0,
        title: "Chapter 1",
        previewAudioPath: null,
        sentences: [buildSentence("", 0, defaultPace, defaultPauseMs, defaultPreset)],
      },
    ];
  }

  const lines = normalized.split("\n");
  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentTitle = "Chapter 1";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && CHAPTER_HEADING_PATTERN.test(trimmed)) {
      if (currentLines.length > 0 || sections.length > 0) {
        sections.push({ title: currentTitle, lines: currentLines });
      }
      currentTitle = trimmed.replace(/^#{1,6}\s*/, "");
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  sections.push({ title: currentTitle, lines: currentLines });

  return sections.map((section, chapterIndex) => {
    const sentenceIndex = { value: 0 };
    const paragraphs = section.lines.join("\n").split(/\n\s*\n/g);
    const sentences = paragraphs.flatMap((paragraph) =>
      parseBlock(paragraph, sentenceIndex, defaultPace, defaultPauseMs, defaultPreset),
    );

    return {
      id: randomUUID(),
      index: chapterIndex,
      title: section.title || `Chapter ${chapterIndex + 1}`,
      previewAudioPath: null,
      sentences:
        sentences.length > 0
          ? sentences
          : [buildSentence("", 0, defaultPace, defaultPauseMs, defaultPreset)],
    };
  });
}

export function parseDictionaryInput(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((dictionary, line) => {
      const [key, ...rest] = line.split("=");
      if (!key || rest.length === 0) {
        return dictionary;
      }

      dictionary[key.trim()] = rest.join("=").trim();
      return dictionary;
    }, {});
}

export function dictionaryToLines(dictionary: Record<string, string>) {
  return Object.entries(dictionary)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}
