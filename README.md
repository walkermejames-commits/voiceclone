# ChipVoice Studio V1

ChipVoice Studio V1 is a local-first audiobook workshop for writers. It is a Next.js / React / TypeScript app for creating projects, importing manuscripts, editing chapter sentences, generating WAV narration with installed Windows voices, previewing chapters, adding simple explicit SFX tags, and exporting WAV or ZIP audio.

V1 is intentionally small and local. It stores project files under `data/projects/{projectId}` and uses Windows `System.Speech` through PowerShell for narration.

## First Run Checklist

1. Install Node.js 20 or newer.
2. Clone the repo.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.
6. Open `http://localhost:3000/health` and confirm Windows voices are detected.
7. Create a project.
8. Paste the sample manuscript below.
9. Pick an installed Windows voice in the narrator profile.
10. Generate one sentence.
11. Generate a chapter preview.
12. Export a chapter WAV or all-chapters ZIP.

## Windows PowerShell Setup

Use PowerShell from the project folder:

```powershell
cd C:\path\to\voiceclone
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

The app calls Windows PowerShell internally with `-ExecutionPolicy Bypass` for the individual narrator process. You do not need to globally change script execution policy for normal narration generation.

## Health Check

Open:

```text
http://localhost:3000/health
```

The health page shows:

- app version
- platform
- Node version
- data directory status
- installed Windows voices count
- project count
- narrator backend status

It does not require a microphone, Supabase, API keys, GPU, or model downloads.

You can also run:

```powershell
npm run doctor
```

For a full local verification pass:

```powershell
npm run check
```

`npm run check` runs the doctor script, TypeScript, lint, and production build.

## Requirements

- Windows 10 or Windows 11 for audio generation
- Node.js 20+
- At least one installed Windows speech voice

The app can build on non-Windows platforms, but narration generation requires Windows `System.Speech`.

## Install More Windows Voices

On Windows 11:

1. Open Settings.
2. Go to Time & language.
3. Open Speech.
4. Add or install voices for the language you want.
5. Restart `npm run dev`.
6. Check `/health` again.

If no voices appear, confirm Windows Speech settings show installed voices and restart the dev server.

## Quick Test Manuscript

Paste this into a new project and click `Parse manuscript`:

```text
# Chapter 1
The lane was empty when Mara reached the gate. [sfx: rain]
She waited for the latch to settle before stepping inside.

# Chapter 2
[sfx: footsteps]
"I know you're there," she said.
The old door answered with a slow complaint. [sfx: door]
```

Then generate sentence audio, generate a chapter preview, and export audio.

## What Works Now

- project dashboard and project creation
- local file-based persistence under `data/projects/{projectId}`
- manuscript import by paste, `.txt`, `.md`, and `.docx`
- conservative chapter and sentence parsing
- narrator profiles with voice, pace, pause, preset, and pronunciation dictionary
- per-sentence editing and regeneration
- Windows `System.Speech` WAV generation
- explicit placeholder SFX tags like `[sfx: rain]`, `[sfx: door]`, and `[sfx: footsteps]`
- chapter preview assembly
- chapter WAV export
- all-chapters ZIP export with `metadata.json`
- reference narration uploads for listening/context notes
- booth mode recording shelf for local takes
- `/health`, `npm run doctor`, and `npm run check`

## What Is Planned Later

- real voice cloning
- optional local XTTS integration
- optional cloud/provider render backends
- waveform or timeline editing
- background job orchestration
- automatic SFX detection
- multi-user SaaS storage

## Voice Cloning Status

Despite the repository name, ChipVoice Studio V1 does not clone voices. V1 is narration production using voices already installed on Windows.

Future work may add optional local voice cloning or voice conversion, but it must be explicit, consent-based, and clearly separated from the current Windows narrator workflow. Never clone, imitate, or publish a real person's voice without their permission.

Reference narration uploads in V1 are only listening references for style, pacing, pronunciation, demo production, or archival context. They are not automatically used as training data.

## Local Storage Layout

```text
data/projects/{projectId}/project.json
data/projects/{projectId}/audio/sentences/
data/projects/{projectId}/audio/chapters/
data/projects/{projectId}/exports/
data/projects/{projectId}/assets/
data/projects/{projectId}/assets/reference-audio/
data/projects/{projectId}/annotated-script/script.json
data/projects/{projectId}/recordings/takes.json
```

Generated project data is intentionally ignored by Git.

## Troubleshooting

### Audio Does Not Generate

1. Open `/health`.
2. Confirm the platform is Windows.
3. Confirm Windows voices count is greater than zero.
4. Confirm the selected narrator voice still exists in Windows settings.
5. Try generating one short sentence before generating a full chapter.

### PowerShell Script Execution Is Blocked

The app uses PowerShell with `-ExecutionPolicy Bypass` for the narrator process. If your organization blocks PowerShell completely, narration generation will fail. The app should show the PowerShell error in the UI. Use `/health` to confirm the issue.

### `npm run build` Fails

Run:

```powershell
npm install
npm run doctor
npm run typecheck
npm run lint
npm run build
```

If the failure mentions Windows voices, use `/health`; build itself should not require voices.

### TXT / MD / DOCX Import

Plain text and Markdown are read as UTF-8 text. DOCX import uses `mammoth` to extract raw text. If a DOCX file cannot be read, paste the manuscript text directly as a fallback.

### Reference Narration Uploads

Reference uploads are supported for `.mp3`, `.wav`, and `.m4a` files up to 250 MB. They are experimental listening/context assets, not cloning sources.

## Repository Notes

`services/xtts_server` is an optional experimental helper service for future local XTTS work. The Next.js app in V1 does not call it.

Supabase, ElevenLabs, and local XTTS settings may appear in `.env.example` from earlier planning work, but V1 does not require them for the local Windows narrator workflow.
