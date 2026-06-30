import { NextResponse } from "next/server";

import { uploadReferenceNarrationAsset } from "@/lib/server/projects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const project = await uploadReferenceNarrationAsset(id, formData);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload reference narration asset" },
      { status: 400 },
    );
  }
}
