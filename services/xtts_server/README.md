# XTTS Server

This is the self-hosted voice service for ChipVoice Studio.

It supports two deployment styles with the same API:

- same machine as the Next.js app
- another desktop on your local network

## Install

```bash
cd services/xtts_server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run on the same machine

```bash
set XTTS_SERVER_HOST=127.0.0.1
set XTTS_SERVER_PORT=8020
python app.py
```

Then set the web app to:

```env
VOICE_PROVIDER=local-xtts
LOCAL_TTS_SERVER_URL=http://127.0.0.1:8020
```

## Run on another desktop in your LAN

On the voice server machine:

```bash
set XTTS_SERVER_HOST=0.0.0.0
set XTTS_SERVER_PORT=8020
set XTTS_SHARED_TOKEN=choose-a-secret
python app.py
```

On your laptop, point the web app to that machine:

```env
VOICE_PROVIDER=local-xtts
LOCAL_TTS_SERVER_URL=http://192.168.x.x:8020
LOCAL_TTS_SERVER_TOKEN=choose-a-secret
```

## Notes

- XTTS downloads model weights on first use.
- GPU is strongly recommended.
- CPU-only works, but can be slow on older hardware.
- The current MVP uses the first saved sample as the voice reference for synthesis.
