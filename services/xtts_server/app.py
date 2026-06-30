from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from TTS.api import TTS


MODEL_NAME = os.getenv("XTTS_MODEL_NAME", "tts_models/multilingual/multi-dataset/xtts_v2")
VOICE_ROOT = Path(os.getenv("XTTS_VOICE_ROOT", Path(__file__).resolve().parent / "voices"))
AUTH_TOKEN = os.getenv("XTTS_SHARED_TOKEN", "")
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("XTTS_ALLOW_ORIGINS", "*").split(",")
    if origin.strip()
]

app = FastAPI(title="ChipVoice XTTS Server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_tts: Optional[TTS] = None


class GenerateRequest(BaseModel):
    voice_id: str
    text: str
    previous_text: Optional[str] = None
    next_text: Optional[str] = None
    language: str = "en"
    speed: float = 1.0
    style_prompt: str = ""


def require_token(token: Optional[str]) -> None:
    if AUTH_TOKEN and token != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing server token.")


def get_tts() -> TTS:
    global _tts
    if _tts is None:
        device = "cuda" if os.getenv("XTTS_DEVICE", "auto") in ("auto", "cuda") else "cpu"
        _tts = TTS(MODEL_NAME).to(device)
    return _tts


def get_voice_dir(voice_id: str) -> Path:
    voice_dir = VOICE_ROOT / voice_id
    if not voice_dir.exists():
        raise HTTPException(status_code=404, detail="Voice profile not found.")
    return voice_dir


def list_voice_samples(voice_id: str) -> list[str]:
    voice_dir = get_voice_dir(voice_id)
    samples = sorted(
        [
            str(path)
            for path in voice_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".wav", ".mp3", ".m4a", ".flac"}
        ]
    )
    if not samples:
        raise HTTPException(status_code=400, detail="Voice profile has no usable samples.")
    return samples


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        {
            "ok": True,
            "model": MODEL_NAME,
            "device": os.getenv("XTTS_DEVICE", "auto"),
            "voice_root": str(VOICE_ROOT),
        }
    )


@app.post("/voices")
async def create_voice(
    name: str = Form(...),
    notes: str = Form(""),
    samples: list[UploadFile] = File(...),
    x_chipvoice_token: Optional[str] = Header(default=None),
) -> JSONResponse:
    require_token(x_chipvoice_token)
    if not samples:
        raise HTTPException(status_code=400, detail="At least one sample is required.")

    voice_id = uuid.uuid4().hex
    voice_dir = VOICE_ROOT / voice_id
    voice_dir.mkdir(parents=True, exist_ok=True)

    for sample in samples:
        content = await sample.read()
        (voice_dir / sample.filename).write_bytes(content)

    (voice_dir / "meta.txt").write_text(f"name={name}\nnotes={notes}\n", encoding="utf-8")
    return JSONResponse(
        {
            "voice_id": voice_id,
            "status": "ready",
            "sample_count": len(samples),
        }
    )


@app.post("/voices/{voice_id}/samples")
async def add_voice_sample(
    voice_id: str,
    sample: UploadFile = File(...),
    x_chipvoice_token: Optional[str] = Header(default=None),
) -> JSONResponse:
    require_token(x_chipvoice_token)
    voice_dir = get_voice_dir(voice_id)
    content = await sample.read()
    (voice_dir / sample.filename).write_bytes(content)
    return JSONResponse({"ok": True})


@app.post("/generate")
async def generate_audio(
    request: GenerateRequest,
    x_chipvoice_token: Optional[str] = Header(default=None),
) -> Response:
    require_token(x_chipvoice_token)
    samples = list_voice_samples(request.voice_id)
    tts = get_tts()

    # XTTS supports direct voice cloning from reference audio.
    # This service keeps the contract simple so the Next.js app can talk to it
    # whether it is running on the same machine or a LAN desktop.
    wav = tts.tts(
        text=request.text,
        speaker_wav=samples[0],
        language=request.language,
        split_sentences=False,
    )

    if request.speed and abs(request.speed - 1.0) > 0.01:
        # MVP note: speed is accepted at the API layer but not stretched here.
        # We keep the contract stable for later DSP upgrades.
        pass

    pcm16 = bytearray()
    for sample in wav:
        clipped = max(-1.0, min(1.0, float(sample)))
        value = int(clipped * 32767.0)
        pcm16.extend(int(value).to_bytes(2, byteorder="little", signed=True))

    return Response(content=bytes(pcm16), media_type="application/octet-stream")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("XTTS_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("XTTS_SERVER_PORT", "8020"))
    uvicorn.run("app:app", host=host, port=port, reload=False)
