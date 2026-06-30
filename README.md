# ChipVoice Studio V1

ChipVoice Studio is a desktop-first audiobook workshop for writers. This rebuild is intentionally small and local: create a project, import manuscript text, edit chapters and sentences, generate real Windows narrator audio, preview chapters, add simple explicit SFX tags, and export WAV files or a zip bundle.

## Reference narration assets

Projects can keep one or more reference narration assets alongside the manuscript and generated chapter audio. These uploads are for style reference, pacing reference, pronunciation reference, demo/test production, and archival listening context.

Reference narration assets are intentionally separate from any future cloning or training source workflow:

- they are attached to a project as listening references
- they are not treated as voice-cloning training data automatically
- cloned or synthetic narration can still be useful as a reference, but should not be assumed to be ideal training material later

## Narrator backend

V1 uses Windows `System.Speech` as the only narrator backend. It is local, offline, and writes real mono WAV files.

## What works

- project dashboard and project creation
- local file-based persistence under `data/projects/{projectId}`
- manuscript import by paste, `.txt`, `.md`, and `.docx`
- conservative chapter and sentence parsing
- narrator profiles with voice, pace, pause, preset, and pronunciation dictionary
- per-sentence editing, sentence generation, regeneration, and preview
- explicit SFX tags like `[sfx: rain]`, `[sfx: door]`, and `[sfx: footsteps]`
- chapter preview assembly with pauses between generated sentence clips
- chapter WAV export and all-chapters zip export with `metadata.json`
- reference narration uploads with notes, purpose labels, playback, primary style reference selection, and lightweight metadata capture

## What is intentionally deferred

- voice cloning
- XTTS or ElevenLabs
- cloud or remote render infrastructure
- background job orchestration
- waveform or timeline editing
- automatic SFX detection
- SaaS or multi-user features

## Requirements

- Windows
- Node.js 20+
- installed Windows speech voices

## Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quick test path

1. Create a new project.
2. Paste this sample manuscript into the manuscript panel and click `Parse manuscript`:

```text
# Chapter 1
The lane was empty when Mara reached the gate. [sfx: rain]
She waited for the latch to settle before stepping inside.

# Chapter 2
[sfx: footsteps]
"I know you're there," she said.
The old door answered with a slow complaint. [sfx: door]
```

3. In the studio, click `Generate audio` on a few sentences.
4. Click `Generate chapter preview`.
5. Use `Export chapter WAV` or `Export all chapters zip`.

## Local storage layout

```text
data/projects/{projectId}/project.json
data/projects/{projectId}/audio/sentences/
data/projects/{projectId}/audio/chapters/
data/projects/{projectId}/exports/
data/projects/{projectId}/assets/
data/projects/{projectId}/assets/reference-audio/
```
