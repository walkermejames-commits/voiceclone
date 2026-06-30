"use client";

import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PerformanceScriptEditor, SpeakerKeyPanel } from "@/components/performance-script-editor";
import { Badge, Button, Field, Input, LinkButton, Panel, Select, Textarea } from "@/components/ui";
import { DELIVERY_PRESET_OPTIONS } from "@/lib/shared/presets";
import type {
  ProjectRecord,
  ReferenceNarrationAsset,
  ReferenceNarrationAssetType,
  SentenceItem,
  SpeakerProfile,
  ScriptLine,
} from "@/lib/shared/types";

const REFERENCE_ASSET_TYPE_OPTIONS: Array<{
  value: ReferenceNarrationAssetType;
  label: string;
}> = [
  { value: "style-reference", label: "Style reference" },
  { value: "pronunciation-reference", label: "Pronunciation reference" },
  { value: "pacing-reference", label: "Pacing reference" },
  { value: "demo-narration", label: "Demo narration" },
  { value: "archival-audio", label: "Archival audio" },
];

function dictionaryToLines(dictionary: Record<string, string>) {
  return Object.entries(dictionary)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function linesToDictionary(value: string) {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      }),
  );
}

function tagsToLine(tags: string[]) {
  return tags.join(", ");
}

function lineToTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function audioUrl(projectId: string, relativePath: string | null) {
  if (!relativePath) {
    return "";
  }

  return `/api/projects/${projectId}/audio/${relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function statusLabel(project: ProjectRecord) {
  if (project.generationStatus.totalSentences === 0) {
    return "Awaiting manuscript";
  }

  if (project.generationStatus.generatedSentences === 0) {
    return "Ready to generate";
  }

  if (
    project.generationStatus.generatedSentences === project.generationStatus.totalSentences &&
    project.generationStatus.generatedChapters === project.generationStatus.totalChapters
  ) {
    return "Chapter previews ready";
  }

  return "In progress";
}

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "Not available";
  }

  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0 ? `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s` : `${remainingSeconds}s`;
}

function formatSampleRate(sampleRateHz: number | null) {
  return sampleRateHz ? `${(sampleRateHz / 1000).toFixed(sampleRateHz % 1000 === 0 ? 0 : 1)} kHz` : "Not available";
}

function formatChannels(channels: number | null) {
  if (!channels) {
    return "Not available";
  }

  return channels === 1 ? "Mono" : `${channels} channels`;
}

function formatBitrate(bitrateKbps: number | null) {
  return bitrateKbps ? `${bitrateKbps} kbps` : "Not available";
}

function referenceTypeLabel(assetType: ReferenceNarrationAssetType) {
  return REFERENCE_ASSET_TYPE_OPTIONS.find((option) => option.value === assetType)?.label ?? assetType;
}

function measureFileDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}

export function ProjectStudio({
  project,
  voices,
}: {
  project: ProjectRecord;
  voices: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedChapterId, setSelectedChapterId] = useState(project.chapters[0]?.id ?? "");
  const [draftProject, setDraftProject] = useState(project);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploadingReferenceAsset, setIsUploadingReferenceAsset] = useState(false);

  useEffect(() => {
    setDraftProject(project);
    if (!project.chapters.some((chapter) => chapter.id === selectedChapterId)) {
      setSelectedChapterId(project.chapters[0]?.id ?? "");
    }
  }, [project, selectedChapterId]);

  const selectedChapter = useMemo(
    () => draftProject.chapters.find((chapter) => chapter.id === selectedChapterId) ?? draftProject.chapters[0],
    [draftProject, selectedChapterId],
  );
  const primaryReferenceAsset = useMemo(
    () =>
      draftProject.referenceNarrationAssets.find((asset) => asset.id === draftProject.primaryReferenceAssetId) ??
      null,
    [draftProject],
  );
  const selectedChapterScriptLines = useMemo(
    () => draftProject.annotatedScript.lines.filter((line) => line.chapterId === selectedChapter?.id),
    [draftProject.annotatedScript.lines, selectedChapter?.id],
  );

  function updateSentence(sentenceId: string, patch: Partial<SentenceItem>) {
    setDraftProject((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id !== selectedChapter?.id
          ? chapter
          : {
              ...chapter,
              sentences: chapter.sentences.map((sentence) =>
                sentence.id === sentenceId ? { ...sentence, ...patch } : sentence,
              ),
            },
      ),
    }));
  }

  function updateProjectField<K extends keyof ProjectRecord>(key: K, value: ProjectRecord[K]) {
    setDraftProject((current) => ({ ...current, [key]: value }));
  }

  function updateNarratorField<K extends keyof ProjectRecord["narrator"]>(
    key: K,
    value: ProjectRecord["narrator"][K],
  ) {
    setDraftProject((current) => ({
      ...current,
      narrator: {
        ...current.narrator,
        [key]: value,
      },
    }));
  }

  function updateReferenceAsset(assetId: string, patch: Partial<ReferenceNarrationAsset>) {
    setDraftProject((current) => ({
      ...current,
      referenceNarrationAssets: current.referenceNarrationAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              ...patch,
              analysis: {
                ...asset.analysis,
                ...patch.analysis,
                placeholders: {
                  ...asset.analysis.placeholders,
                  ...patch.analysis?.placeholders,
                },
              },
            }
          : asset,
      ),
    }));
  }

  function updateScriptLine(lineId: string, patch: Partial<ScriptLine>) {
    setDraftProject((current) => ({
      ...current,
      annotatedScript: {
        ...current.annotatedScript,
        lines: current.annotatedScript.lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                ...patch,
              }
            : line,
        ),
      },
    }));
  }

  function updateSpeakerProfile(speakerId: string, patch: Partial<SpeakerProfile>) {
    setDraftProject((current) => ({
      ...current,
      annotatedScript: {
        ...current.annotatedScript,
        speakerProfiles: current.annotatedScript.speakerProfiles.map((speaker) =>
          speaker.id === speakerId
            ? {
                ...speaker,
                ...patch,
              }
            : speaker,
        ),
        lines: current.annotatedScript.lines.map((line) => {
          if (line.speakerProfileId !== speakerId) {
            return line;
          }

          return {
            ...line,
            colorTag: patch.color ?? line.colorTag,
          };
        }),
      },
    }));
  }

  async function handleJsonSubmit(url: string, payload: unknown, success: string) {
    try {
      setMessage(null);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Request failed");
      }

      setMessage(success);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function saveProjectSettings() {
    await handleJsonSubmit(
      `/api/projects/${project.id}`,
      {
        title: draftProject.title,
        author: draftProject.author,
        description: draftProject.description,
        narratorName: draftProject.narrator.name,
        voice: draftProject.narrator.voice,
        defaultPace: Number(draftProject.narrator.defaultPace),
        defaultPauseMs: Number(draftProject.narrator.defaultPauseMs),
        defaultDeliveryPreset: draftProject.narrator.defaultDeliveryPreset,
        pronunciationLines: dictionaryToLines(draftProject.narrator.pronunciationDictionary),
      },
      "Project settings saved.",
    );
  }

  async function parseManuscript(formData: FormData) {
    try {
      setMessage(null);
      const response = await fetch(`/api/projects/${project.id}/parse`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Could not parse manuscript");
      }

      setMessage("Manuscript parsed into chapters and sentences.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse manuscript");
    }
  }

  async function generateAnnotatedScript() {
    await handleJsonSubmit(
      `/api/projects/${project.id}/annotated-script`,
      { action: "generate" },
      "Annotated performance script generated. Review speaker assignments before recording.",
    );
  }

  async function saveAnnotatedScript() {
    await handleJsonSubmit(
      `/api/projects/${project.id}/annotated-script`,
      {
        action: "save",
        annotatedScript: draftProject.annotatedScript,
      },
      "Annotated script saved.",
    );
  }

  async function saveSentence(sentence: SentenceItem) {
    await handleJsonSubmit(
      `/api/projects/${project.id}/sentence`,
      {
        action: "save",
        chapterId: selectedChapter.id,
        sentenceId: sentence.id,
        text: sentence.text,
        pace: Number(sentence.pace),
        pauseMs: Number(sentence.pauseMs),
        deliveryPreset: sentence.deliveryPreset,
        pronunciationLines: dictionaryToLines(sentence.pronunciationOverrides),
      },
      "Sentence updated.",
    );
  }

  async function generateSentence(sentence: SentenceItem) {
    await handleJsonSubmit(
      `/api/projects/${project.id}/sentence`,
      {
        action: "generate",
        chapterId: selectedChapter.id,
        sentenceId: sentence.id,
        text: sentence.text,
        pace: Number(sentence.pace),
        pauseMs: Number(sentence.pauseMs),
        deliveryPreset: sentence.deliveryPreset,
        pronunciationLines: dictionaryToLines(sentence.pronunciationOverrides),
      },
      sentence.sfxTag ? "SFX clip generated." : "Sentence audio generated.",
    );
  }

  async function generateChapter() {
    await handleJsonSubmit(
      `/api/projects/${project.id}/chapter`,
      { chapterId: selectedChapter.id },
      "Chapter preview assembled.",
    );
  }

  async function saveReferenceNarrationAsset(asset: ReferenceNarrationAsset, markPrimaryStyleReference = false) {
    await handleJsonSubmit(
      `/api/projects/${project.id}/reference-assets`,
      {
        assetId: asset.id,
        title: asset.title,
        notes: asset.notes,
        assetType: asset.assetType,
        manualStyleSummary: asset.analysis.manualStyleSummary,
        estimatedAveragePaceNote: asset.analysis.estimatedAveragePaceNote,
        referenceTags: asset.analysis.referenceTags,
        markPrimaryStyleReference,
      },
      markPrimaryStyleReference ? "Primary style reference updated." : "Reference narration asset saved.",
    );
  }

  async function uploadReferenceNarrationAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a narration file to upload.");
      return;
    }

    try {
      setIsUploadingReferenceAsset(true);
      setMessage(null);
      const duration = await measureFileDuration(file);
      if (duration) {
        formData.set("clientDurationSeconds", String(duration));
      }

      if (!draftProject.primaryReferenceAssetId) {
        formData.set("markPrimary", "true");
      }

      const response = await fetch(`/api/projects/${project.id}/reference-assets/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Could not upload reference narration asset");
      }

      event.currentTarget.reset();
      setMessage("Reference narration asset uploaded.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload reference narration asset");
    } finally {
      setIsUploadingReferenceAsset(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="space-y-6">
        <Panel>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">
                Project status
              </p>
              <h2 className="mt-2 font-serif text-2xl text-[var(--text-main)]">{statusLabel(project)}</h2>
            </div>
            <div className="grid gap-3 text-sm text-[var(--text-soft)]">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Sentences</div>
                <div className="mt-2 text-xl text-[var(--text-main)]">
                  {project.generationStatus.generatedSentences}/{project.generationStatus.totalSentences}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Chapters</div>
                <div className="mt-2 text-xl text-[var(--text-main)]">
                  {project.generationStatus.generatedChapters}/{project.generationStatus.totalChapters}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Chapters</p>
              <h2 className="mt-2 font-serif text-2xl">Studio map</h2>
            </div>
            <Badge>{draftProject.chapters.length} total</Badge>
          </div>
          <div className="mt-4 grid gap-2">
            {draftProject.chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setSelectedChapterId(chapter.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  chapter.id === selectedChapter?.id
                    ? "border-[var(--accent)] bg-[var(--panel-strong)]"
                    : "border-[var(--line)] bg-transparent hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Chapter {chapter.index + 1}
                </div>
                <div className="mt-1 text-sm text-[var(--text-main)]">{chapter.title}</div>
                <div className="mt-2 text-xs text-[var(--text-soft)]">{chapter.sentences.length} clips</div>
              </button>
            ))}
          </div>
        </Panel>
      </aside>

      <main className="space-y-6">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Studio</p>
            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="font-serif text-4xl text-[var(--text-main)]">{draftProject.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
                  Edit the manuscript, generate sentence audio with the house narrator, assemble chapter previews, and export finished WAV files.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" tone="secondary" onClick={() => void generateChapter()} disabled={isPending}>
                  Generate chapter preview
                </Button>
                <LinkButton href={`/api/projects/${project.id}/export?chapterId=${selectedChapter.id}`} tone="secondary">
                  Export chapter WAV
                </LinkButton>
                <LinkButton href={`/api/projects/${project.id}/export`}>Export all chapters zip</LinkButton>
              </div>
            </div>
            {message ? <p className="mt-4 text-sm text-[var(--accent)]">{message}</p> : null}
          </div>

          <div className="px-6 py-5">
            <Panel className="mb-6 bg-[rgba(9,12,16,0.92)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Performance Script Mode</Badge>
                    <Badge>{draftProject.annotatedScript.lines.length > 0 ? "ready to review" : "not generated"}</Badge>
                  </div>
                  <h2 className="mt-3 font-serif text-3xl text-[var(--text-main)]">Author-read audiobook workflow</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                    Turn the manuscript into an annotated read-aloud script, review speaker colours and cues, then step
                    into booth mode for focused narration and local take capture.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Script lines</div>
                      <div className="mt-2 text-2xl text-[var(--text-main)]">{draftProject.annotatedScript.lines.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Speaker key</div>
                      <div className="mt-2 text-2xl text-[var(--text-main)]">{draftProject.annotatedScript.speakerProfiles.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Booth takes</div>
                      <div className="mt-2 text-2xl text-[var(--text-main)]">{draftProject.recordingWorkspace.takes.length}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" tone="secondary" onClick={() => void generateAnnotatedScript()} disabled={isPending}>
                    Generate annotated script
                  </Button>
                  <Button type="button" tone="secondary" onClick={() => void saveAnnotatedScript()} disabled={isPending || draftProject.annotatedScript.lines.length === 0}>
                    Save script edits
                  </Button>
                  <LinkButton href={`/projects/${project.id}/booth`}>Open booth mode</LinkButton>
                </div>
              </div>
              <div className="mt-5 grid gap-2 text-sm text-[var(--text-soft)]">
                {draftProject.annotatedScript.generationNotes.map((note) => (
                  <div key={note} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3">
                    {note}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="mb-6 bg-[var(--panel-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Reference narration</Badge>
                    {primaryReferenceAsset ? <Badge className="text-[var(--accent)]">Primary style reference</Badge> : null}
                  </div>
                  <h2 className="mt-3 font-serif text-2xl text-[var(--text-main)]">
                    {primaryReferenceAsset ? primaryReferenceAsset.title : "No primary reference selected yet"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-soft)]">
                    This is a project reference asset for pacing, delivery feel, pronunciation, and demo work. It is not treated as a voice-cloning training source automatically, and cloned or synthetic narration should not be assumed to be ideal future training material.
                  </p>
                  {primaryReferenceAsset ? (
                    <div className="mt-4 grid gap-2 text-sm text-[var(--text-soft)]">
                      <div>Purpose: {referenceTypeLabel(primaryReferenceAsset.assetType)}</div>
                      <div>Manual style summary: {primaryReferenceAsset.analysis.manualStyleSummary || "None yet"}</div>
                      <div>Estimated pace note: {primaryReferenceAsset.analysis.estimatedAveragePaceNote || "None yet"}</div>
                      <div>Reference tags: {tagsToLine(primaryReferenceAsset.analysis.referenceTags) || "None yet"}</div>
                      <div>Notes: {primaryReferenceAsset.notes || "None yet"}</div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-soft)]">
                      Upload a narration file on the right to keep a listening reference close while editing this project.
                    </p>
                  )}
                </div>
                {primaryReferenceAsset ? (
                  <div className="w-full max-w-md space-y-3">
                    <audio controls className="w-full" src={audioUrl(project.id, primaryReferenceAsset.filePath)} />
                    <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-dim)]">
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Duration
                        <div className="mt-1 text-sm text-[var(--text-main)]">
                          {formatDuration(primaryReferenceAsset.durationSeconds)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Format
                        <div className="mt-1 text-sm text-[var(--text-main)]">
                          {(primaryReferenceAsset.format ?? "unknown").toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">
                  Chapter {selectedChapter.index + 1}
                </p>
                <h2 className="mt-1 font-serif text-3xl text-[var(--text-main)]">{selectedChapter.title}</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  {selectedChapterScriptLines.length} annotated script lines are available for this chapter.
                </p>
              </div>
              {selectedChapter.previewAudioPath ? (
                <audio controls className="w-full max-w-sm" src={audioUrl(project.id, selectedChapter.previewAudioPath)} />
              ) : null}
            </div>

            <div className="mt-6">
              <PerformanceScriptEditor
                project={draftProject}
                selectedChapterId={selectedChapter.id}
                isPending={isPending}
                onGenerate={generateAnnotatedScript}
                onSave={saveAnnotatedScript}
                onLineChange={updateScriptLine}
              />
            </div>

            <div className="mt-6 grid gap-4">
              {selectedChapter.sentences.map((sentence) => (
                <Panel key={sentence.id} className="bg-[var(--panel-soft)]">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-3">
                        <Badge>{sentence.sfxTag ? "SFX cue" : `Sentence ${sentence.index + 1}`}</Badge>
                        {sentence.sfxTag ? (
                          <span className="text-sm text-[var(--text-soft)]">[{`sfx: ${sentence.sfxTag}`}]</span>
                        ) : null}
                      </div>
                      {sentence.audioPath ? (
                        <audio controls className="w-full max-w-sm" src={audioUrl(project.id, sentence.audioPath)} />
                      ) : null}
                    </div>

                    <Textarea
                      value={sentence.text}
                      onChange={(event) => updateSentence(sentence.id, { text: event.target.value })}
                      rows={sentence.sfxTag ? 2 : 4}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Pace" hint="0.7 - 1.3">
                        <Input
                          type="number"
                          min={0.7}
                          max={1.3}
                          step={0.05}
                          value={sentence.pace}
                          onChange={(event) => updateSentence(sentence.id, { pace: Number(event.target.value || 1) })}
                        />
                      </Field>
                      <Field label="Pause" hint="milliseconds">
                        <Input
                          type="number"
                          min={100}
                          max={1500}
                          step={20}
                          value={sentence.pauseMs}
                          onChange={(event) =>
                            updateSentence(sentence.id, { pauseMs: Number(event.target.value || 380) })
                          }
                        />
                      </Field>
                      <Field label="Delivery preset">
                        <Select
                          value={sentence.deliveryPreset}
                          onChange={(event) =>
                            updateSentence(sentence.id, {
                              deliveryPreset: event.target.value as SentenceItem["deliveryPreset"],
                            })
                          }
                        >
                          {DELIVERY_PRESET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    {!sentence.sfxTag ? (
                      <Field label="Pronunciation overrides" hint="one per line, word=spoken form">
                        <Textarea
                          rows={3}
                          value={dictionaryToLines(sentence.pronunciationOverrides)}
                          onChange={(event) =>
                            updateSentence(sentence.id, {
                              pronunciationOverrides: linesToDictionary(event.target.value),
                            })
                          }
                        />
                      </Field>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <Button type="button" tone="secondary" onClick={() => void saveSentence(sentence)} disabled={isPending}>
                        Save sentence
                      </Button>
                      <Button type="button" onClick={() => void generateSentence(sentence)} disabled={isPending}>
                        {sentence.audioPath ? "Regenerate audio" : sentence.sfxTag ? "Generate SFX" : "Generate audio"}
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </Panel>
      </main>

      <aside className="space-y-6">
        <SpeakerKeyPanel annotatedScript={draftProject.annotatedScript} onSpeakerChange={updateSpeakerProfile} />

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Recording foundations</p>
              <h2 className="mt-2 font-serif text-2xl">Take shelf</h2>
            </div>
            <Badge>{draftProject.recordingWorkspace.takes.length}</Badge>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
            Booth takes save locally under <code>data/projects/{project.id}/recordings</code>. Use booth mode for mic
            capture, elapsed time, level metering, playback, and lightweight pacing or silence warnings.
          </p>
          <div className="mt-4 space-y-3">
            {draftProject.recordingWorkspace.takes.slice(0, 3).map((take) => (
              <div key={take.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{take.lineId ? "Line take" : "Section take"}</Badge>
                  <Badge>{take.feedback.clippingRisk} clip risk</Badge>
                </div>
                <div className="mt-3 text-sm text-[var(--text-main)]">{take.name}</div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">{take.feedback.pacingNote}</div>
              </div>
            ))}
            {draftProject.recordingWorkspace.takes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--text-soft)]">
                No booth takes saved yet.
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <LinkButton href={`/projects/${project.id}/booth`} tone="secondary">
              Open booth mode
            </LinkButton>
          </div>
        </Panel>

        <Panel>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Reference assets</p>
            <h2 className="mt-2 font-serif text-2xl">Narration shelf</h2>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
            Upload narration that helps with style, pacing, pronunciation, or demo production. These files stay separate from future cloning or training sources.
          </p>
          <form className="mt-4 grid gap-4" onSubmit={(event) => void uploadReferenceNarrationAsset(event)}>
            <Field label="Reference file" hint=".mp3, .wav, .m4a">
              <Input
                name="file"
                type="file"
                accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a"
              />
            </Field>
            <Field label="Title">
              <Input name="title" placeholder="Chapter 3 delivery pass" />
            </Field>
            <Field label="Reference purpose">
              <Select name="assetType" defaultValue="style-reference">
                {REFERENCE_ASSET_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" rows={3} placeholder="What makes this useful as a reference?" />
            </Field>
            <Field label="Manual style summary" hint="optional">
              <Input name="manualStyleSummary" placeholder="Measured, warm, a little hushed" />
            </Field>
            <Field label="Estimated pace note" hint="optional">
              <Input name="estimatedAveragePaceNote" placeholder="Unhurried chapter narration" />
            </Field>
            <Field label="Reference tags" hint="comma separated">
              <Input name="referenceTags" placeholder="audiobook, intimate, chapter-open" />
            </Field>
            <label className="flex items-center gap-3 text-sm text-[var(--text-soft)]">
              <input name="markPrimary" type="checkbox" value="true" className="h-4 w-4 rounded border-[var(--line)]" />
              Mark this upload as the primary style reference
            </label>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 text-sm leading-7 text-[var(--text-soft)]">
              Reference asset only. It is not used as a voice-cloning seed automatically. A cloned or synthetic file can still be useful for pacing or demo work, but it should not be assumed to be ideal training material later.
            </div>
            <Button type="submit" disabled={isPending || isUploadingReferenceAsset}>
              {isUploadingReferenceAsset ? "Uploading..." : "Upload reference narration"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Attached assets</p>
              <h2 className="mt-2 font-serif text-2xl">Project audio references</h2>
            </div>
            <Badge>{draftProject.referenceNarrationAssets.length}</Badge>
          </div>
          <div className="mt-4 space-y-4">
            {draftProject.referenceNarrationAssets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-7 text-[var(--text-soft)]">
                No narration references are attached yet.
              </div>
            ) : (
              draftProject.referenceNarrationAssets.map((asset) => (
                <Panel key={asset.id} className="bg-[var(--panel-soft)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{referenceTypeLabel(asset.assetType)}</Badge>
                    {draftProject.primaryReferenceAssetId === asset.id ? (
                      <Badge className="text-[var(--accent)]">Primary style reference</Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-4">
                    <Field label="Title">
                      <Input
                        value={asset.title}
                        onChange={(event) => updateReferenceAsset(asset.id, { title: event.target.value })}
                      />
                    </Field>
                    <Field label="Reference purpose">
                      <Select
                        value={asset.assetType}
                        onChange={(event) =>
                          updateReferenceAsset(asset.id, {
                            assetType: event.target.value as ReferenceNarrationAssetType,
                          })
                        }
                      >
                        {REFERENCE_ASSET_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <audio controls className="w-full" src={audioUrl(project.id, asset.filePath)} />
                    <div className="grid gap-3 text-xs text-[var(--text-dim)] sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Original file
                        <div className="mt-1 text-sm text-[var(--text-main)]">{asset.originalFilename}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Stored path
                        <div className="mt-1 break-all text-sm text-[var(--text-main)]">{asset.filePath}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Duration
                        <div className="mt-1 text-sm text-[var(--text-main)]">{formatDuration(asset.durationSeconds)}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Format / bitrate
                        <div className="mt-1 text-sm text-[var(--text-main)]">
                          {(asset.format ?? "unknown").toUpperCase()} / {formatBitrate(asset.bitrateKbps)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Sample rate
                        <div className="mt-1 text-sm text-[var(--text-main)]">{formatSampleRate(asset.sampleRateHz)}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                        Channels
                        <div className="mt-1 text-sm text-[var(--text-main)]">{formatChannels(asset.channels)}</div>
                      </div>
                    </div>
                    <Field label="Notes">
                      <Textarea
                        rows={4}
                        value={asset.notes}
                        onChange={(event) => updateReferenceAsset(asset.id, { notes: event.target.value })}
                      />
                    </Field>
                    <Field label="Manual style summary">
                      <Textarea
                        rows={3}
                        value={asset.analysis.manualStyleSummary}
                        onChange={(event) =>
                          updateReferenceAsset(asset.id, {
                            analysis: {
                              ...asset.analysis,
                              manualStyleSummary: event.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label="Estimated pace note">
                      <Input
                        value={asset.analysis.estimatedAveragePaceNote}
                        onChange={(event) =>
                          updateReferenceAsset(asset.id, {
                            analysis: {
                              ...asset.analysis,
                              estimatedAveragePaceNote: event.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label="Reference tags" hint="comma separated">
                      <Input
                        value={tagsToLine(asset.analysis.referenceTags)}
                        onChange={(event) =>
                          updateReferenceAsset(asset.id, {
                            analysis: {
                              ...asset.analysis,
                              referenceTags: lineToTags(event.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" tone="secondary" onClick={() => void saveReferenceNarrationAsset(asset)} disabled={isPending}>
                        Save asset details
                      </Button>
                      <Button type="button" onClick={() => void saveReferenceNarrationAsset(asset, true)} disabled={isPending}>
                        Make primary style reference
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Project details</p>
            <h2 className="mt-2 font-serif text-2xl">Desk sheet</h2>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Title">
              <Input value={draftProject.title} onChange={(event) => updateProjectField("title", event.target.value)} />
            </Field>
            <Field label="Author">
              <Input value={draftProject.author} onChange={(event) => updateProjectField("author", event.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea rows={4} value={draftProject.description} onChange={(event) => updateProjectField("description", event.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Narrator profile</p>
            <h2 className="mt-2 font-serif text-2xl">Generic narrator</h2>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Profile name">
              <Input value={draftProject.narrator.name} onChange={(event) => updateNarratorField("name", event.target.value)} />
            </Field>
            <Field label="Voice">
              <Select value={draftProject.narrator.voice} onChange={(event) => updateNarratorField("voice", event.target.value)}>
                {voices.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default pace">
              <Input
                type="number"
                min={0.7}
                max={1.3}
                step={0.05}
                value={draftProject.narrator.defaultPace}
                onChange={(event) => updateNarratorField("defaultPace", Number(event.target.value || 1))}
              />
            </Field>
            <Field label="Default pause" hint="milliseconds">
              <Input
                type="number"
                min={100}
                max={1500}
                step={20}
                value={draftProject.narrator.defaultPauseMs}
                onChange={(event) => updateNarratorField("defaultPauseMs", Number(event.target.value || 380))}
              />
            </Field>
            <Field label="Default delivery preset">
              <Select
                value={draftProject.narrator.defaultDeliveryPreset}
                onChange={(event) =>
                  updateNarratorField(
                    "defaultDeliveryPreset",
                    event.target.value as ProjectRecord["narrator"]["defaultDeliveryPreset"],
                  )
                }
              >
                {DELIVERY_PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Global pronunciation dictionary" hint="one per line, word=spoken form">
              <Textarea
                rows={5}
                value={dictionaryToLines(draftProject.narrator.pronunciationDictionary)}
                onChange={(event) => updateNarratorField("pronunciationDictionary", linesToDictionary(event.target.value))}
              />
            </Field>
            <Button type="button" onClick={() => void saveProjectSettings()} disabled={isPending}>
              Save project settings
            </Button>
          </div>
        </Panel>

        <Panel>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Manuscript import</p>
            <h2 className="mt-2 font-serif text-2xl">Parse text</h2>
          </div>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const file = formData.get("file");
              if (!(file instanceof File) || file.size === 0) {
                formData.set("manuscriptText", draftProject.manuscriptText);
              }
              void parseManuscript(formData);
            }}
          >
            <Field label="Paste manuscript">
              <Textarea
                name="manuscriptText"
                rows={12}
                value={draftProject.manuscriptText}
                onChange={(event) => updateProjectField("manuscriptText", event.target.value)}
              />
            </Field>
            <Field label="Or upload a file" hint=".txt, .md, .docx">
              <Input name="file" type="file" accept=".txt,.md,.docx,text/plain,text/markdown" />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isPending}>
                Parse manuscript
              </Button>
              <Button
                type="button"
                tone="secondary"
                onClick={() => void generateAnnotatedScript()}
                disabled={isPending || !draftProject.manuscriptText.trim()}
              >
                Generate annotated script
              </Button>
            </div>
          </form>
        </Panel>
      </aside>
    </div>
  );
}
