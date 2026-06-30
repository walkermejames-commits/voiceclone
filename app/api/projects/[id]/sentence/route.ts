import { NextResponse } from "next/server";

import { generateSentence, saveSentence } from "@/lib/server/projects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project =
      body.action === "generate"
        ? await generateSentence(id, body)
        : await saveSentence(id, body);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sentence action failed" },
      { status: 400 },
    );
  }
}
