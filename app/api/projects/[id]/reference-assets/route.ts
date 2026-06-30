import { NextResponse } from "next/server";

import { updateReferenceNarrationAsset } from "@/lib/server/projects";
import type { ReferenceNarrationAssetType } from "@/lib/shared/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await updateReferenceNarrationAsset(id, {
      assetId: String(body.assetId ?? ""),
      title: String(body.title ?? ""),
      notes: String(body.notes ?? ""),
      assetType: String(body.assetType ?? "style-reference") as ReferenceNarrationAssetType,
      manualStyleSummary: String(body.manualStyleSummary ?? ""),
      estimatedAveragePaceNote: String(body.estimatedAveragePaceNote ?? ""),
      referenceTags: Array.isArray(body.referenceTags) ? body.referenceTags.map(String) : [],
      markPrimaryStyleReference: Boolean(body.markPrimaryStyleReference),
    });
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update reference narration asset" },
      { status: 400 },
    );
  }
}
