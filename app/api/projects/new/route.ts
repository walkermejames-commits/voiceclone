import { NextResponse } from "next/server";

import { createProject } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const project = await createProject({
      title: String(formData.get("title") ?? ""),
      author: String(formData.get("author") ?? ""),
      description: String(formData.get("description") ?? ""),
    });

    return NextResponse.redirect(new URL(`/projects/${project.id}`, request.url));
  } catch (error) {
    const url = new URL("/projects/new", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Could not create project.",
    );
    return NextResponse.redirect(url);
  }
}
