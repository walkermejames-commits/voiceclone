"use client";

import { Badge, Button, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import type { AnnotatedScript, PerformanceCue, ProjectRecord, ScriptLine, SpeakerProfile } from "@/lib/shared/types";

function cueMarkersToText(cueMarkers: PerformanceCue[]) {
  return cueMarkers.map((cue) => `${cue.label}|${cue.note}`).join("\n");
}

function textToCueMarkers(value: string, existing: PerformanceCue[]) {
  const fallbackType = existing[0]?.type ?? "tone";
  const fallbackIntensity = existing[0]?.intensity ?? "light";

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, ...rest] = line.split("|");
      return {
        id: existing[index]?.id ?? `manual-${index}-${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: existing[index]?.type ?? fallbackType,
        label: label.trim(),
        note: rest.join("|").trim() || label.trim(),
        intensity: existing[index]?.intensity ?? fallbackIntensity,
        isManual: true,
      } satisfies PerformanceCue;
    });
}

function pronunciationNotesToText(pronunciationNotes: string[]) {
  return pronunciationNotes.join("\n");
}

function textToPronunciationNotes(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function SpeakerKeyPanel({
  annotatedScript,
  onSpeakerChange,
}: {
  annotatedScript: AnnotatedScript;
  onSpeakerChange: (speakerId: string, patch: Partial<SpeakerProfile>) => void;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Speaker key</p>
          <h2 className="mt-2 font-serif text-2xl">Character legend</h2>
        </div>
        <Badge>{annotatedScript.speakerProfiles.length}</Badge>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
        Auto-detected speakers are approximate. Adjust names, colours, delivery notes, and pronunciation reminders here.
      </p>
      <div className="mt-4 space-y-4">
        {annotatedScript.speakerProfiles.map((speaker) => (
          <div key={speaker.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="h-4 w-4 rounded-full border border-white/10"
                style={{ backgroundColor: speaker.color }}
              />
              <Badge>{speaker.detectionSource}</Badge>
            </div>
            <div className="grid gap-4">
              <Field label="Name">
                <Input value={speaker.name} onChange={(event) => onSpeakerChange(speaker.id, { name: event.target.value })} />
              </Field>
              <Field label="Colour">
                <Input value={speaker.color} onChange={(event) => onSpeakerChange(speaker.id, { color: event.target.value })} />
              </Field>
              <Field label="Voice / narrator note">
                <Textarea
                  rows={2}
                  value={speaker.voiceNote}
                  onChange={(event) => onSpeakerChange(speaker.id, { voiceNote: event.target.value })}
                />
              </Field>
              <Field label="Pronunciation notes" hint="one per line">
                <Textarea
                  rows={3}
                  value={pronunciationNotesToText(speaker.pronunciationNotes)}
                  onChange={(event) =>
                    onSpeakerChange(speaker.id, { pronunciationNotes: textToPronunciationNotes(event.target.value) })
                  }
                />
              </Field>
              <Field label="Delivery note">
                <Textarea
                  rows={2}
                  value={speaker.deliveryNote}
                  onChange={(event) => onSpeakerChange(speaker.id, { deliveryNote: event.target.value })}
                />
              </Field>
              <Field label="Optional generic voice assignment">
                <Input
                  value={speaker.genericVoiceAssignment ?? ""}
                  onChange={(event) =>
                    onSpeakerChange(speaker.id, { genericVoiceAssignment: event.target.value || null })
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PerformanceScriptEditor({
  project,
  selectedChapterId,
  isPending,
  onGenerate,
  onSave,
  onLineChange,
}: {
  project: ProjectRecord;
  selectedChapterId: string;
  isPending: boolean;
  onGenerate: () => Promise<void>;
  onSave: () => Promise<void>;
  onLineChange: (lineId: string, patch: Partial<ScriptLine>) => void;
}) {
  const lines = project.annotatedScript.lines.filter((line) => line.chapterId === selectedChapterId);

  return (
    <Panel className="bg-[var(--panel-soft)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Performance Script Mode</Badge>
            <Badge>{project.annotatedScript.generationMethod}</Badge>
          </div>
          <h2 className="mt-3 font-serif text-3xl">Annotated script editor</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
            Build a read-aloud script with visible speaker changes, cue markers, pacing reminders, pronunciation notes,
            and manual corrections before stepping into booth mode.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-[var(--text-soft)]">
            {project.annotatedScript.generationNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3">
                {note}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" tone="secondary" onClick={() => void onGenerate()} disabled={isPending}>
            Generate annotated script
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={isPending || lines.length === 0}>
            Save annotation edits
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Script lines</div>
          <div className="mt-2 text-2xl">{project.annotatedScript.lines.length}</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Speakers in key</div>
          <div className="mt-2 text-2xl">{project.annotatedScript.speakerProfiles.length}</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">Current chapter lines</div>
          <div className="mt-2 text-2xl">{lines.length}</div>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-[var(--line)] px-5 py-8 text-sm leading-7 text-[var(--text-soft)]">
          Generate an annotated script after importing the manuscript. Manual speaker assignment stays available
          afterward for any uncertain or unknown lines.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {lines.map((line) => {
            const speaker = project.annotatedScript.speakerProfiles.find((item) => item.id === line.speakerProfileId) ?? null;

            return (
              <div
                key={line.id}
                className="rounded-[26px] border border-[var(--line)] bg-[rgba(10,12,16,0.86)] p-5"
                style={{ boxShadow: speaker ? `inset 4px 0 0 ${speaker.color}` : undefined }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{line.lineType}</Badge>
                  {line.sectionLabel ? <Badge>{line.sectionLabel}</Badge> : null}
                  {speaker ? (
                    <Badge className="text-[var(--text-main)]" style={{ borderColor: speaker.color, color: speaker.color }}>
                      {speaker.name}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-4">
                  <Field label="Original line">
                    <Textarea value={line.originalText} rows={2} readOnly />
                  </Field>
                  <Field label="Performance text">
                    <Textarea
                      value={line.performanceText}
                      rows={3}
                      onChange={(event) => onLineChange(line.id, { performanceText: event.target.value })}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Speaker assignment">
                      <Select
                        value={line.speakerProfileId ?? ""}
                        onChange={(event) => onLineChange(line.id, { speakerProfileId: event.target.value || null })}
                      >
                        <option value="">No speaker tag</option>
                        {project.annotatedScript.speakerProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Colour tag">
                      <Input value={line.colorTag ?? ""} onChange={(event) => onLineChange(line.id, { colorTag: event.target.value || null })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Pacing note">
                      <Input value={line.pacingNote} onChange={(event) => onLineChange(line.id, { pacingNote: event.target.value })} />
                    </Field>
                    <Field label="Emphasis note">
                      <Input value={line.emphasisNote} onChange={(event) => onLineChange(line.id, { emphasisNote: event.target.value })} />
                    </Field>
                  </div>
                  <Field label="Pronunciation notes" hint="one per line">
                    <Textarea
                      rows={3}
                      value={pronunciationNotesToText(line.pronunciationNotes)}
                      onChange={(event) =>
                        onLineChange(line.id, { pronunciationNotes: textToPronunciationNotes(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Cue markers" hint="label|note">
                    <Textarea
                      rows={3}
                      value={cueMarkersToText(line.cueMarkers)}
                      onChange={(event) =>
                        onLineChange(line.id, {
                          cueMarkers: textToCueMarkers(event.target.value, line.cueMarkers),
                        })
                      }
                    />
                  </Field>
                  <Field label="Optional performance note">
                    <Textarea
                      rows={2}
                      value={line.performanceNote}
                      onChange={(event) => onLineChange(line.id, { performanceNote: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
