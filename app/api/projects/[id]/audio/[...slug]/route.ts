import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { audioContentType } from "@/lib/server/reference-audio";
import { safeProjectPath } from "@/lib/server/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; slug: string[] }> },
) {
  try {
    const { id, slug } = await params;
    const relativePath = slug.join(path.posix.sep);
    const buffer = await readFile(safeProjectPath(id, relativePath));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": audioContentType(relativePath),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audio not found" },
      { status: 404 },
    );
  }
}
