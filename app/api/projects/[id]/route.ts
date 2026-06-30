import { NextResponse } from "next/server";

import { getProject, updateProject } from "@/lib/server/projects";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getProject(id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project not found" },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await updateProject(id, body);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update project" },
      { status: 400 },
    );
  }
}
