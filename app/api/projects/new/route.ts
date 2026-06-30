import { NextResponse } from "next/server";

import { createProject } from "@/lib/server/projects";

export async function POST(request: Request) {
  const formData = await request.formData();
  const project = await createProject({
    title: String(formData.get("title") ?? ""),
    author: String(formData.get("author") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  return NextResponse.redirect(new URL(`/projects/${project.id}`, request.url));
}
