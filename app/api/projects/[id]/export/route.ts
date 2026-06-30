import { readFile } from "node:fs/promises";

import { buildExport } from "@/lib/server/projects";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const chapterId = url.searchParams.get("chapterId") ?? undefined;
  const exported = await buildExport(id, chapterId);
  const buffer = await readFile(exported.filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
