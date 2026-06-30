import { NextResponse } from "next/server";

import { getVoices } from "@/lib/server/projects";

export async function GET() {
  try {
    const voices = await getVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load voices" },
      { status: 500 },
    );
  }
}
