import os
import time
import json
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Depends, Request, HTTPException, status, UploadFile, File, Form, Response, Header
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from pydantic import BaseModel
import shutil
import uuid
import secrets
import soundfile as sf
import numpy as np

from database import init_db, get_db, Voice, ApiClient, ApiClientStat, TtsHistory

# Need to import Kokoro carefully, will mock if not available during early setup
try:
    from kokoro_onnx import Kokoro
except ImportError:
    Kokoro = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
models_dir = os.path.join(data_dir, "models")
os.makedirs(models_dir, exist_ok=True)

history_dir = os.path.join(data_dir, "history_audio")
os.makedirs(history_dir, exist_ok=True)

temp_dir = os.path.join(os.getcwd(), "temp_kokoro_chunks")
os.makedirs(temp_dir, exist_ok=True)

kokoro_model: Optional[Any] = None

@app.on_event("startup")
async def startup_event():
    await init_db()

    # Initialize Kokoro
    global kokoro_model
    model_path = os.path.join(models_dir, "kokoro-v1.0.onnx")
    voices_path = os.path.join(models_dir, "voices-v1.0.bin")

    if os.path.exists(model_path) and os.path.exists(voices_path):
        try:
            print("Loading Kokoro ONNX model...")
            kokoro_model = Kokoro(model_path, voices_path)
            print("Kokoro TTS Model successfully loaded!")
        except Exception as e:
            print(f"Failed to load Kokoro ONNX model: {e}")
    else:
        print(f"Warning: Model files not found at {model_path} or {voices_path}. TTS will not work.")

async def api_auth_middleware(request: Request, db: AsyncSession = Depends(get_db)):
    if os.environ.get("API_ONLY") != "true":
        return None

    client_id = request.headers.get("x-client-id")
    client_secret = request.headers.get("x-client-secret")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing x-client-id or x-client-secret headers",
        )

    result = await db.execute(
        select(ApiClient).where(
            ApiClient.client_id == client_id,
            ApiClient.client_secret == client_secret
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client credentials",
        )
    return client

class TTSRequest(BaseModel):
    message: str
    voice: str = "af_heart"

def chunk_text(text: str, max_words: int = 10) -> List[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), max_words):
        chunks.append(" ".join(words[i:i + max_words]))
    return chunks

@app.post("/api/tts")
async def tts_endpoint(request: Request, body: TTSRequest, db: AsyncSession = Depends(get_db)):
    client = await api_auth_middleware(request, db)

    message = body.message
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    words_processed = len(message.split())

    # Check if voice exists natively, else simulate fallback
    requested_voice = body.voice
    actual_voice_style = requested_voice

    # Check if it's a custom/blended voice in our DB
    result = await db.execute(select(Voice).where(Voice.voice_name == requested_voice))
    custom_voice = result.scalar_one_or_none()

    if custom_voice and custom_voice.is_blended:
        print(f"Blending voices: {custom_voice.voice_a} and {custom_voice.voice_b} with ratio {custom_voice.ratio}")
        try:
            # Get styles for both voices
            style_a = kokoro_model.get_voice_style(custom_voice.voice_a)
            style_b = kokoro_model.get_voice_style(custom_voice.voice_b)
            # Blend them: ratio applies to voice_b
            actual_voice_style = style_a * (1.0 - custom_voice.ratio) + style_b * custom_voice.ratio
        except Exception as e:
            print(f"Error blending voices, falling back to default: {e}")
            actual_voice_style = "af_heart"
    elif custom_voice:
        # For non-blended custom voices (legacy or other), fallback
        print(f"Using custom voice '{requested_voice}' (falling back to 'af_heart' for actual TTS simulation)")
        actual_voice_style = "af_heart"

    async def event_generator():
        start_time = time.time()
        ttfb_ms = 0
        all_samples = []
        sample_rate = 24000 # Default for Kokoro

        yield f"data: {json.dumps({'status': 'thinking'})}\n\n"

        if not kokoro_model:
            yield f"data: {json.dumps({'error': 'TTS Model not loaded'})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'text', 'text': message})}\n\n"

        chunks = chunk_text(message, max_words=10)

        for i, text_chunk in enumerate(chunks):
            if await request.is_disconnected():
                print("Client disconnected, stopping TTS generation.")
                break

            if not text_chunk.strip():
                continue

            try:
                # This could be run in a thread pool for true concurrency, but keeping simple for now
                loop = asyncio.get_event_loop()
                samples, sample_rate = await loop.run_in_executor(
                    None,
                    lambda: kokoro_model.create(text_chunk, voice=actual_voice_style, speed=1.0, lang="en-us")
                )

                filename = f"chunk-{int(time.time() * 1000)}-{i}.wav"
                filepath = os.path.join(temp_dir, filename)

                # Write audio file
                await loop.run_in_executor(
                    None,
                    lambda: sf.write(filepath, samples, sample_rate)
                )

                if not client:
                    all_samples.append(samples)

                if i == 0:
                    ttfb_ms = int((time.time() - start_time) * 1000)

                print(f"[Chunk {i}] Processing text: '{text_chunk}'")

                yield f"data: {json.dumps({'status': 'audio', 'text': text_chunk, 'audioUrl': f'/api/audio/{filename}'})}\n\n"

                # Cleanup task (fire and forget)
                async def delete_later(path):
                    await asyncio.sleep(60)
                    try:
                        os.remove(path)
                    except OSError:
                        pass
                asyncio.create_task(delete_later(filepath))

            except Exception as e:
                print(f"Error generating chunk: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return

        # Track stats
        if client:
            new_stat = ApiClientStat(
                client_id=client.client_id,
                words_processed=words_processed,
                ttfb_ms=ttfb_ms
            )
            db.add(new_stat)
            await db.commit()
        else:
            # Handle History (Web Chat Only)
            if all_samples:
                final_audio = np.concatenate(all_samples)
                history_filename = f"history-{int(time.time())}-{uuid.uuid4().hex[:8]}.wav"
                history_filepath = os.path.join(history_dir, history_filename)

                await loop.run_in_executor(
                    None,
                    lambda: sf.write(history_filepath, final_audio, sample_rate)
                )

                new_history = TtsHistory(
                    text=message,
                    voice=requested_voice,
                    audio_path=history_filename
                )
                db.add(new_history)
                await db.commit()

                # Maintain last 100 limit
                result = await db.execute(select(TtsHistory).order_by(TtsHistory.created_at.desc()).offset(100))
                old_records = result.scalars().all()
                for old_rec in old_records:
                    old_path = os.path.join(history_dir, old_rec.audio_path)
                    if os.path.exists(old_path):
                        try:
                            os.remove(old_path)
                        except OSError:
                            pass
                    db.delete(old_rec)
                if old_records:
                    await db.commit()

        if not await request.is_disconnected():
            yield f"data: {json.dumps({'status': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    filepath = os.path.join(temp_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath)

class BlendRequest(BaseModel):
    username: str
    password: str
    voiceName: str
    voiceA: str
    voiceB: str
    ratio: float = 0.5

@app.post("/api/blend")
async def blend_endpoint(body: BlendRequest, db: AsyncSession = Depends(get_db)):
    if body.username != "admin" or body.password != "password":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not body.voiceName:
        raise HTTPException(status_code=400, detail="Voice name is required")

    # Check if voice name already exists
    result = await db.execute(select(Voice).where(Voice.voice_name == body.voiceName))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Voice name already exists")

    new_voice = Voice(
        voice_name=body.voiceName,
        is_blended=True,
        voice_a=body.voiceA,
        voice_b=body.voiceB,
        ratio=body.ratio
    )
    db.add(new_voice)
    await db.commit()

    return {"success": True, "message": f"Voice '{body.voiceName}' blended successfully", "voiceName": body.voiceName}

class ClientRequest(BaseModel):
    username: str
    password: str
    clientName: str

@app.post("/api/clients")
async def create_client(body: ClientRequest, db: AsyncSession = Depends(get_db)):
    if body.username != "admin" or body.password != "password":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    client_id = "client_" + secrets.token_hex(16)
    client_secret = "secret_" + secrets.token_hex(32)

    new_client = ApiClient(
        client_name=body.clientName,
        client_id=client_id,
        client_secret=client_secret
    )
    db.add(new_client)
    await db.commit()

    return {
        "success": True,
        "message": "API Client generated successfully",
        "client": {
            "client_name": body.clientName,
            "client_id": client_id,
            "client_secret": client_secret
        }
    }

class AnalyticsRequest(BaseModel):
    username: str
    password: str

@app.post("/api/analytics")
async def get_analytics(body: AnalyticsRequest, db: AsyncSession = Depends(get_db)):
    if body.username != "admin" or body.password != "password":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Group by client and get stats
    query = (
        select(
            ApiClient.client_name,
            func.count(ApiClientStat.id).label("total_files_generated"),
            func.sum(ApiClientStat.words_processed).label("total_words_processed"),
            func.avg(ApiClientStat.ttfb_ms).label("avg_ttfb_ms")
        )
        .outerjoin(ApiClientStat, ApiClient.client_id == ApiClientStat.client_id)
        .group_by(ApiClient.client_id, ApiClient.client_name)
    )

    result = await db.execute(query)
    rows = result.all()

    stats = []
    for row in rows:
        stats.append({
            "client_name": row.client_name,
            "total_files_generated": row.total_files_generated or 0,
            "total_words_processed": row.total_words_processed or 0,
            "avg_ttfb_ms": int(row.avg_ttfb_ms) if row.avg_ttfb_ms else 0
        })

    return stats

@app.get("/api/voices")
async def get_voices(request: Request, db: AsyncSession = Depends(get_db)):
    await api_auth_middleware(request, db)

    result = await db.execute(select(Voice).order_by(Voice.created_at.desc()))
    voices = result.scalars().all()

    return [
        {
            "id": v.id,
            "voice_name": v.voice_name,
            "file_path": v.file_path,
            "original_filename": v.original_filename,
            "created_at": v.created_at.isoformat()
        }
        for v in voices
    ]

@app.get("/api/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TtsHistory).order_by(TtsHistory.created_at.desc()))
    history = result.scalars().all()
    return [
        {
            "id": h.id,
            "text": h.text,
            "voice": h.voice,
            "created_at": h.created_at.isoformat()
        }
        for h in history
    ]

@app.get("/api/history/download/{history_id}")
async def download_history(history_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TtsHistory).where(TtsHistory.id == history_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="History item not found")

    filepath = os.path.join(history_dir, item.audio_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        filepath,
        media_type="audio/wav",
        filename=f"tts-history-{history_id}.wav"
    )
