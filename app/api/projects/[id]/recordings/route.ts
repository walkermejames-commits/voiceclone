import { NextResponse } from "next/server";

import { saveRecordingTake } from "@/lib/server/projects";

function parseNullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      throw new Error("No recording audio was received.");
    }

    const project = await saveRecordingTake(id, {
      chapterId: String(formData.get("chapterId") ?? ""),
      lineId: String(formData.get("lineId") ?? "").trim() || null,
      name: String(formData.get("name") ?? "Booth take"),
      mimeType: audio.type || String(formData.get("mimeType") ?? "audio/webm"),
      notes: String(formData.get("notes") ?? ""),
      durationSeconds: parseNullableNumber(formData.get("durationSeconds")),
      peakLevel: parseNullableNumber(formData.get("peakLevel")),
      rmsLevel: parseNullableNumber(formData.get("rmsLevel")),
      silenceDurationSeconds: parseNullableNumber(formData.get("silenceDurationSeconds")),
      buffer: Buffer.from(await audio.arrayBuffer()),
    });

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recording upload failed" },
      { status: 400 },
    );
  }
}
