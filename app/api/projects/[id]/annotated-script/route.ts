import { NextResponse } from "next/server";

import { generateProjectAnnotatedScript, saveProjectAnnotatedScript } from "@/lib/server/projects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project =
      body.action === "generate"
        ? await generateProjectAnnotatedScript(id)
        : await saveProjectAnnotatedScript(id, body.annotatedScript);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Annotated script action failed" },
      { status: 400 },
    );
  }
}
