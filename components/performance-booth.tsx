"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import type { ProjectRecord } from "@/lib/shared/types";

function audioUrl(projectId: string, relativePath: string | null) {
  if (!relativePath) {
    return "";
  }

  return `/api/projects/${projectId}/audio/${relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatSeconds(value: number | null) {
  if (!value || !Number.isFinite(value)) {
    return "0:00";
  }

  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

export function PerformanceBooth({ project }: { project: ProjectRecord }) {
  const [projectState, setProjectState] = useState(project);
  const [selectedChapterId, setSelectedChapterId] = useState(
    project.annotatedScript.lines[0]?.chapterId ?? project.chapters[0]?.id ?? "",
  );
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "focused">("focused");
  const [minimalMode, setMinimalMode] = useState(false);
  const [takeScope, setTakeScope] = useState<"line" | "chapter">("line");
  const [takeName, setTakeName] = useState("");
  const [takeNotes, setTakeNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterIntervalRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const metricsRef = useRef({
    peakLevel: 0,
    rmsTotal: 0,
    sampleCount: 0,
    silenceSeconds: 0,
  });

  useEffect(() => {
    setProjectState(project);
  }, [project]);

  const chapterLines = useMemo(
    () => projectState.annotatedScript.lines.filter((line) => line.chapterId === selectedChapterId),
    [projectState, selectedChapterId],
  );
  const currentLine =
    chapterLines.find((line) => line.id === currentLineId) ??
    chapterLines.find((line) => line.lineType !== "note") ??
    chapterLines[0] ??
    null;
  const currentIndex = currentLine ? chapterLines.findIndex((line) => line.id === currentLine.id) : -1;
  const visibleFocusedLines =
    currentIndex >= 0 ? chapterLines.slice(Math.max(0, currentIndex - 1), currentIndex + 2) : chapterLines.slice(0, 3);

  useEffect(() => {
    if (!currentLine && chapterLines[0]) {
      setCurrentLineId(chapterLines[0].id);
      return;
    }

    if (currentLine && !chapterLines.some((line) => line.id === currentLine.id)) {
      setCurrentLineId(chapterLines[0]?.id ?? null);
    }
  }, [chapterLines, currentLine]);

  useEffect(() => {
    if (viewMode !== "standard" || !currentLine?.id) {
      return;
    }

    document.getElementById(`booth-line-${currentLine.id}`)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [currentLine?.id, viewMode]);

  useEffect(() => {
    return () => {
      if (meterIntervalRef.current) {
        window.clearInterval(meterIntervalRef.current);
      }
      if (elapsedIntervalRef.current) {
        window.clearInterval(elapsedIntervalRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  function resetRecorderResources() {
    if (meterIntervalRef.current) {
      window.clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setMicLevel(0);
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function moveLine(direction: -1 | 1) {
    if (currentIndex < 0) {
      return;
    }

    const next = chapterLines[currentIndex + direction];
    if (next) {
      setCurrentLineId(next.id);
    }
  }

  async function startRecording() {
    try {
      setMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: false,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextCtor();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = preferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      metricsRef.current = { peakLevel: 0, rmsTotal: 0, sampleCount: 0, silenceSeconds: 0 };
      setElapsedSeconds(0);
      setIsRecording(true);

      meterIntervalRef.current = window.setInterval(() => {
        const activeAnalyser = analyserRef.current;
        if (!activeAnalyser) {
          return;
        }

        const buffer = new Uint8Array(activeAnalyser.fftSize);
        activeAnalyser.getByteTimeDomainData(buffer);

        let peak = 0;
        let rms = 0;
        for (const sample of buffer) {
          const normalized = Math.abs((sample - 128) / 128);
          peak = Math.max(peak, normalized);
          rms += normalized * normalized;
        }

        rms = Math.sqrt(rms / buffer.length);
        setMicLevel(peak);
        metricsRef.current.peakLevel = Math.max(metricsRef.current.peakLevel, peak);
        metricsRef.current.rmsTotal += rms;
        metricsRef.current.sampleCount += 1;

        if (rms < 0.02) {
          metricsRef.current.silenceSeconds += 0.12;
        }
      }, 120);

      elapsedIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((currentValue) => Number((currentValue + 1).toFixed(1)));
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          setIsUploading(true);
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, `${(takeName || currentLine?.speakerProfileId || "take").replace(/\s+/g, "-")}.webm`);
          formData.append("chapterId", selectedChapterId);
          formData.append("lineId", takeScope === "line" ? currentLine?.id ?? "" : "");
          formData.append(
            "name",
            takeName || (takeScope === "line" ? `Line ${currentLine?.lineOrder ?? 0} take` : `${currentLine?.sectionLabel ?? "Chapter"} booth take`),
          );
          formData.append("notes", takeNotes);
          formData.append("durationSeconds", String(elapsedSeconds));
          formData.append("peakLevel", String(metricsRef.current.peakLevel));
          formData.append(
            "rmsLevel",
            String(
              metricsRef.current.sampleCount > 0 ? metricsRef.current.rmsTotal / metricsRef.current.sampleCount : 0,
            ),
          );
          formData.append("silenceDurationSeconds", String(metricsRef.current.silenceSeconds));
          formData.append("mimeType", blob.type || recorder.mimeType || "audio/webm");

          const response = await fetch(`/api/projects/${projectState.id}/recordings`, {
            method: "POST",
            body: formData,
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.error ?? "Could not save recording take");
          }

          setProjectState(result);
          setMessage("Take saved to the project recordings folder.");
          setTakeName("");
          setTakeNotes("");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not save recording take");
        } finally {
          setIsUploading(false);
          setIsRecording(false);
          resetRecorderResources();
        }
      };

      recorder.start(250);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Microphone access failed");
      setIsRecording(false);
      resetRecorderResources();
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  const chapterTakes = projectState.recordingWorkspace.takes.filter((take) => take.chapterId === selectedChapterId);

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      {!minimalMode ? (
        <aside className="space-y-6">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Booth mode</p>
                <h2 className="mt-2 font-serif text-3xl">Reader HUD</h2>
              </div>
              <Badge>{viewMode}</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="Chapter">
                <Select value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                  {projectState.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      Chapter {chapter.index + 1}: {chapter.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" tone={viewMode === "standard" ? "default" : "secondary"} onClick={() => setViewMode("standard")}>
                  Standard view
                </Button>
                <Button type="button" tone={viewMode === "focused" ? "default" : "secondary"} onClick={() => setViewMode("focused")}>
                  Focused booth
                </Button>
              </div>
              <Button type="button" tone="ghost" onClick={() => setMinimalMode(true)}>
                Minimal distraction mode
              </Button>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Speaker key</p>
                <h2 className="mt-2 font-serif text-2xl">Who is speaking</h2>
              </div>
              <Badge>{projectState.annotatedScript.speakerProfiles.length}</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {projectState.annotatedScript.speakerProfiles.map((speaker) => (
                <div key={speaker.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: speaker.color }} />
                    <div className="text-sm text-[var(--text-main)]">{speaker.name}</div>
                  </div>
                  {speaker.deliveryNote ? (
                    <div className="mt-2 text-xs leading-6 text-[var(--text-soft)]">{speaker.deliveryNote}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      ) : null}

      <main className="space-y-6">
        <Panel className="border-[rgba(201,176,140,0.25)] bg-[rgba(6,8,11,0.96)] p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-dim)]">Performance booth</p>
              <h1 className="mt-2 font-serif text-4xl md:text-5xl">Read-aloud interface</h1>
            </div>
            {minimalMode ? (
              <Button type="button" tone="secondary" onClick={() => setMinimalMode(false)}>
                Exit minimal mode
              </Button>
            ) : null}
          </div>
          {message ? <p className="mt-4 text-sm text-[var(--accent)]">{message}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" tone="secondary" onClick={() => moveLine(-1)} disabled={currentIndex <= 0}>
              Previous line
            </Button>
            <Button type="button" tone="secondary" onClick={() => moveLine(1)} disabled={currentIndex >= chapterLines.length - 1}>
              Next line
            </Button>
            <Badge>
              {currentIndex >= 0 ? `${currentIndex + 1} / ${chapterLines.length}` : `0 / ${chapterLines.length}`}
            </Badge>
          </div>

          {viewMode === "focused" ? (
            <div className="mt-8 space-y-5">
              {visibleFocusedLines.map((line) => {
                const speaker = projectState.annotatedScript.speakerProfiles.find((item) => item.id === line.speakerProfileId) ?? null;
                const isCurrent = line.id === currentLine?.id;

                return (
                  <div
                    key={line.id}
                    className={`rounded-[30px] border px-6 py-6 transition ${
                      isCurrent
                        ? "border-[var(--accent)] bg-[rgba(16,20,26,0.98)] shadow-[0_0_0_1px_rgba(201,176,140,0.18)]"
                        : "border-[var(--line)] bg-[rgba(11,14,18,0.78)] opacity-60"
                    }`}
                    style={{ boxShadow: isCurrent && speaker ? `inset 6px 0 0 ${speaker.color}` : undefined }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{line.lineType}</Badge>
                      {speaker ? (
                        <Badge className="text-[var(--text-main)]" style={{ borderColor: speaker.color, color: speaker.color }}>
                          {speaker.name}
                        </Badge>
                      ) : null}
                      {line.sectionLabel ? <Badge>{line.sectionLabel}</Badge> : null}
                    </div>
                    <div className={`mt-5 leading-[1.45] ${isCurrent ? "text-4xl md:text-5xl" : "text-2xl text-[var(--text-soft)]"}`}>
                      {line.performanceText}
                    </div>
                    <div className="mt-5 grid gap-2 text-sm text-[var(--text-soft)]">
                      {line.pronunciationNotes.length > 0 ? <div>Pronunciation: {line.pronunciationNotes.join(" | ")}</div> : null}
                      {line.pacingNote ? <div>Pacing: {line.pacingNote}</div> : null}
                      {line.emphasisNote ? <div>Emphasis: {line.emphasisNote}</div> : null}
                      {line.cueMarkers.length > 0 ? (
                        <div>
                          Cues: {line.cueMarkers.map((cue) => cue.label).join(" | ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {chapterLines.map((line) => {
                const speaker = projectState.annotatedScript.speakerProfiles.find((item) => item.id === line.speakerProfileId) ?? null;
                const isCurrent = line.id === currentLine?.id;

                return (
                  <button
                    id={`booth-line-${line.id}`}
                    key={line.id}
                    type="button"
                    onClick={() => setCurrentLineId(line.id)}
                    className={`block w-full rounded-[24px] border px-5 py-5 text-left transition ${
                      isCurrent
                        ? "border-[var(--accent)] bg-[rgba(16,20,26,0.98)]"
                        : "border-[var(--line)] bg-[rgba(10,12,16,0.78)] hover:border-[var(--line-strong)]"
                    }`}
                    style={{ boxShadow: speaker ? `inset 4px 0 0 ${speaker.color}` : undefined }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{line.lineType}</Badge>
                      {speaker ? (
                        <Badge className="text-[var(--text-main)]" style={{ borderColor: speaker.color, color: speaker.color }}>
                          {speaker.name}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-4 text-2xl leading-[1.5]">{line.performanceText}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </main>

      <aside className="space-y-6">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Recording panel</p>
              <h2 className="mt-2 font-serif text-2xl">Capture takes</h2>
            </div>
            <Badge>{isRecording ? "Live" : "Standby"}</Badge>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Take scope">
              <Select value={takeScope} onChange={(event) => setTakeScope(event.target.value as "line" | "chapter")}>
                <option value="line">Current line</option>
                <option value="chapter">Current chapter section</option>
              </Select>
            </Field>
            <Field label="Take name">
              <Input value={takeName} onChange={(event) => setTakeName(event.target.value)} placeholder="Chapter 2 line pickup" />
            </Field>
            <Field label="Quick note">
              <Textarea rows={2} value={takeNotes} onChange={(event) => setTakeNotes(event.target.value)} placeholder="New character voice, slower close, cleaner ending." />
            </Field>

            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
              <div className="flex items-center justify-between text-sm text-[var(--text-soft)]">
                <span>Mic level</span>
                <span>{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className={`h-full rounded-full transition-all ${micLevel > 0.95 ? "bg-[#d96b5f]" : "bg-[var(--accent)]"}`}
                  style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-soft)]">
                <span>Elapsed</span>
                <span>{formatSeconds(elapsedSeconds)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" onClick={() => void startRecording()} disabled={isRecording || isUploading}>
                Record
              </Button>
              <Button type="button" tone="secondary" onClick={stopRecording} disabled={!isRecording || isUploading}>
                Stop
              </Button>
            </div>
            <p className="text-xs leading-6 text-[var(--text-dim)]">
              Lightweight booth guidance only. Mic levels, silence length, pacing estimates, and clipping warnings are rules-based.
            </p>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Saved takes</p>
              <h2 className="mt-2 font-serif text-2xl">Playback</h2>
            </div>
            <Badge>{chapterTakes.length}</Badge>
          </div>
          <div className="mt-4 space-y-4">
            {chapterTakes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-sm leading-7 text-[var(--text-soft)]">
                No local takes saved for this chapter yet.
              </div>
            ) : (
              chapterTakes.map((take) => (
                <div key={take.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{take.lineId ? "Line take" : "Section take"}</Badge>
                    <Badge>{formatSeconds(take.durationSeconds)}</Badge>
                    <Badge>{take.feedback.clippingRisk} clip risk</Badge>
                  </div>
                  <h3 className="mt-3 text-lg text-[var(--text-main)]">{take.name}</h3>
                  <audio controls className="mt-3 w-full" src={audioUrl(projectState.id, take.filePath)} />
                  <div className="mt-3 grid gap-2 text-sm text-[var(--text-soft)]">
                    <div>{take.feedback.pacingNote}</div>
                    {take.feedback.silenceTooLong ? <div>Pause reminder: silence ran long in this take.</div> : null}
                    {take.feedback.lowVolumeWarning ? <div>Low volume warning: average level was modest.</div> : null}
                    {take.feedback.noiseWarning ? <div>Noise warning: room floor may be noticeable.</div> : null}
                    {take.notes ? <div>Notes: {take.notes}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
