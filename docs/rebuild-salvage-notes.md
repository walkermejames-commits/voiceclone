# Rebuild Salvage Notes

## What the old app attempted

The old app tried to be an end-to-end audiobook studio: project management, manuscript import, sentence editing, voice setup, local and remote TTS providers, SFX suggestions, chapter assembly, and export.

## What parts were useful

- The manuscript import and parsing direction was good.
- The sentence-first editing/studio concept was useful.
- The provider abstraction was a reasonable idea.
- Local-first storage and export were practical for quick iteration.

## What failed repeatedly

- The product scope kept expanding faster than the core workflow stabilized.
- Multiple voice-provider paths created complexity without one dependable happy path.
- "Real cloning later" and "usable now" were mixed together, which blurred priorities.
- The app carried too many partially-finished flows at once.

## Why we are rebuilding

We are rebuilding to get back to a smaller, dependable product with one clear workflow, simpler architecture, and less speculative integration work.

## What V1 now aims to be instead

V1 should be a narrow, practical app: import text, manage a simple project flow, generate usable draft narration through one reliable path, and export clean output. No broad studio ambitions, no extra provider surface area, and no half-built cloning promises in the first version.
