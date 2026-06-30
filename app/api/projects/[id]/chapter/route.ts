import { NextResponse } from "next/server";

import { generateChapter } from "@/lib/server/projects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await generateChapter(id, body.chapterId);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chapter generation failed" },
      { status: 400 },
    );
  }
}
