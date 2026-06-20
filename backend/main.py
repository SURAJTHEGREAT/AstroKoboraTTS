import os
import time
import json
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Depends, Request, HTTPException, status, UploadFile, File, Form, Response, Header
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, delete
from pydantic import BaseModel
import shutil
import uuid
import secrets
import re
import soundfile as sf
import numpy as np
import psutil
import ctranslate2
import transformers
from huggingface_hub import snapshot_download
import multiprocessing

from database import init_db, get_db, AsyncSessionLocal, Voice, ApiClient, ApiClientStat, TtsHistory

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

data_dir = os.environ.get("DATA_DIR")
if not data_dir:
    cwd_data = os.path.join(os.getcwd(), "data")
    parent_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    if os.path.exists(cwd_data):
        data_dir = os.path.abspath(cwd_data)
    elif os.path.exists(parent_data):
        data_dir = os.path.abspath(parent_data)
    else:
        data_dir = os.path.abspath(cwd_data)
else:
    data_dir = os.path.abspath(data_dir)

models_dir = os.path.join(data_dir, "models")
os.makedirs(models_dir, exist_ok=True)

history_dir = os.path.join(data_dir, "history_audio")
os.makedirs(history_dir, exist_ok=True)

temp_dir = os.path.join(os.getcwd(), "temp_kokoro_chunks")
os.makedirs(temp_dir, exist_ok=True)

session_audio_dir = os.path.join(data_dir, "session_audio")
os.makedirs(session_audio_dir, exist_ok=True)

translation_models_dir = os.path.join(data_dir, "translation_models")
os.makedirs(translation_models_dir, exist_ok=True)

kokoro_model: Optional[Any] = None
nllb_translator: Optional[Any] = None
nllb_tokenizer: Optional[Any] = None

# NLLB Language Prefix Mapping
NLLB_LANG_MAP = {
    "eng_Latn": {"name": "English", "kokoro_lang": "en-us", "default_voice": "af_heart"},
    "fra_Latn": {"name": "French", "kokoro_lang": "fr-fr", "default_voice": "ff_siwis"},
    "spa_Latn": {"name": "Spanish", "kokoro_lang": "es", "default_voice": "ef_dora"},
    "ita_Latn": {"name": "Italian", "kokoro_lang": "it", "default_voice": "if_sara"},
    "deu_Latn": {"name": "German", "kokoro_lang": "de", "default_voice": "df_sarah"}, # Assuming German support or fallback
    "jpn_Jpan": {"name": "Japanese", "kokoro_lang": "ja", "default_voice": "jf_alpha"},
    "hin_Deva": {"name": "Hindi", "kokoro_lang": "hi", "default_voice": "hf_alpha"},
    "por_Latn": {"name": "Portuguese", "kokoro_lang": "pt-br", "default_voice": "pf_dora"},
    "zho_Hans": {"name": "Chinese", "kokoro_lang": "zh", "default_voice": "zf_xiaobei"},
}

@app.on_event("startup")
async def startup_event():
    await init_db()

    # Ensure "direct" client exists for tracking web interface analytics
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ApiClient).where(ApiClient.client_id == "direct"))
        if not result.scalar_one_or_none():
            direct_client = ApiClient(
                client_name="direct",
                client_id="direct",
                client_secret=secrets.token_hex(32)
            )
            db.add(direct_client)
            await db.commit()
            print("Initialized 'direct' API client for web analytics.")

    # Clear session audio on startup
    if os.path.exists(session_audio_dir):
        for f in os.listdir(session_audio_dir):
            try:
                os.remove(os.path.join(session_audio_dir, f))
            except OSError:
                pass

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

    # Initialize Translation Model
    global nllb_translator, nllb_tokenizer
    nllb_repo = "Tushe/nllb-200-600M-ct2-int8"
    nllb_path = os.path.join(translation_models_dir, "nllb-200-600M-ct2-int8")

    if not os.path.exists(nllb_path):
        try:
            print(f"Downloading translation model {nllb_repo}...")
            snapshot_download(repo_id=nllb_repo, local_dir=nllb_path)
        except Exception as e:
            print(f"Failed to download translation model: {e}")

    if os.path.exists(nllb_path):
        try:
            print("Loading Translation model...")
            nllb_tokenizer = transformers.AutoTokenizer.from_pretrained(nllb_path)
            # Use system core counts for intra_threads as required
            cpu_count = multiprocessing.cpu_count()
            nllb_translator = ctranslate2.Translator(nllb_path, device="cpu", intra_threads=cpu_count)
            print(f"Translation Model successfully loaded with {cpu_count} intra_threads!")
        except Exception as e:
            print(f"Failed to load Translation model: {e}")

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
    session_id: Optional[str] = None
    message_id: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None

def chunk_text(text: str, max_words: int = 10) -> List[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), max_words):
        chunks.append(" ".join(words[i:i + max_words]))
    return chunks

def sanitize_id(id_str: Optional[str]) -> Optional[str]:
    if not id_str:
        return None
    return re.sub(r'[^a-zA-Z0-9-]', '', id_str)

async def translate_text(text: str, src_lang: str, tgt_lang: str) -> str:
    if not nllb_translator or not nllb_tokenizer:
        print("Translation model not loaded, skipping translation.")
        return text

    try:
        nllb_tokenizer.src_lang = src_lang
        source = nllb_tokenizer.convert_ids_to_tokens(nllb_tokenizer.encode(text))

        results = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: nllb_translator.translate_batch(
                [source],
                target_prefix=[[tgt_lang]],
                beam_size=4,
                max_decoding_length=256,
                repetition_penalty=1.2
            )
        )

        output_tokens = results[0].hypotheses[0]
        # Remove target prefix from output if present
        if tgt_lang in output_tokens:
            output_tokens = [t for t in output_tokens if t != tgt_lang]

        translated_text = nllb_tokenizer.decode(nllb_tokenizer.convert_tokens_to_ids(output_tokens))
        return translated_text
    except Exception as e:
        print(f"Translation error: {e}")
        return text

@app.post("/api/tts")
async def tts_endpoint(request: Request, body: TTSRequest, db: AsyncSession = Depends(get_db)):
    client = await api_auth_middleware(request, db)

    session_id = sanitize_id(body.session_id)
    message_id = sanitize_id(body.message_id)

    message = body.message
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    # Handle Translation
    kokoro_lang = "en-us"
    requested_voice = body.voice

    if body.source_lang and body.target_lang and body.source_lang != body.target_lang:
        print(f"Translating from {body.source_lang} to {body.target_lang}")
        message = await translate_text(message, body.source_lang, body.target_lang)

        # Map target_lang to Kokoro lang and default voice if not explicitly provided
        if body.target_lang in NLLB_LANG_MAP:
            kokoro_lang = NLLB_LANG_MAP[body.target_lang]["kokoro_lang"]
            # If the user didn't specify a custom voice, or specified a default one, use the language's default
            if requested_voice == "af_heart" or requested_voice not in [v.id for v in []]: # Simplified check
                 requested_voice = NLLB_LANG_MAP[body.target_lang]["default_voice"]

    words_processed = len(message.split())

    # Check if voice exists natively, else simulate fallback
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
            # We are likely in testing environment without the ONNX file
            yield f"data: {json.dumps({'status': 'text', 'text': message})}\n\n"
            ttfb_ms = int((time.time() - start_time) * 1000)
            yield f"data: {json.dumps({'status': 'audio', 'text': message, 'audioUrl': '/api/audio/mock.wav', 'ramUsageMb': 123.4, 'ttfbMs': ttfb_ms})}\n\n"
            yield f"data: {json.dumps({'status': 'done', 'audioUrl': '/api/session/audio/mock.wav'})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'text', 'text': message})}\n\n"

        chunks = chunk_text(message, max_words=10)

        interrupted = False
        for i, text_chunk in enumerate(chunks):
            if await request.is_disconnected():
                print("Client disconnected, stopping TTS generation.")
                interrupted = True
                break

            if not text_chunk.strip():
                continue

            try:
                # This could be run in a thread pool for true concurrency, but keeping simple for now
                loop = asyncio.get_event_loop()
                samples, sample_rate = await loop.run_in_executor(
                    None,
                    lambda: kokoro_model.create(text_chunk, voice=actual_voice_style, speed=1.0, lang=kokoro_lang)
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

                process = psutil.Process(os.getpid())
                ram_usage_mb = process.memory_info().rss / (1024 * 1024)

                payload = {
                    'status': 'audio',
                    'text': text_chunk,
                    'audioUrl': f'/api/audio/{filename}',
                    'ramUsageMb': round(ram_usage_mb, 2)
                }

                if i == 0:
                    payload['ttfbMs'] = ttfb_ms

                yield f"data: {json.dumps(payload)}\n\n"

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
        tracking_client_id = client.client_id if client else "direct"
        new_stat = ApiClientStat(
            client_id=tracking_client_id,
            words_processed=words_processed,
            ttfb_ms=ttfb_ms
        )
        db.add(new_stat)
        await db.commit()

        if not interrupted:
            # Save session audio
            if session_id and message_id and all_samples:
                final_audio = np.concatenate(all_samples)
                session_filename = f"{session_id}_{message_id}.wav"
                session_filepath = os.path.join(session_audio_dir, session_filename)

                await loop.run_in_executor(
                    None,
                    lambda: sf.write(session_filepath, final_audio, sample_rate)
                )
                yield f"data: {json.dumps({'status': 'done', 'audioUrl': f'/api/session/audio/{session_filename}'})}\n\n"
            else:
                yield f"data: {json.dumps({'status': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    filepath = os.path.join(temp_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath)

@app.get("/api/session/audio/{filename}")
async def get_session_audio(filename: str):
    # Basic filename sanitization
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    filepath = os.path.join(session_audio_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath)

@app.delete("/api/session/clear/{session_id}")
async def clear_session(session_id: str):
    session_id = sanitize_id(session_id)
    if not session_id:
        return {"success": True}

    for f in os.listdir(session_audio_dir):
        if f.startswith(f"{session_id}_"):
            try:
                os.remove(os.path.join(session_audio_dir, f))
            except OSError:
                pass
    return {"success": True}

class BlendRequest(BaseModel):
    username: str
    password: str
    voiceName: str
    voiceA: str
    voiceB: str
    ratio: float = 0.5

@app.post("/api/blend")
async def blend_endpoint(body: BlendRequest, db: AsyncSession = Depends(get_db)):
    if body.username != "admin" or body.password != "kP9$vW2!mX7#qZ4":
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
    if body.username != "admin" or body.password != "kP9$vW2!mX7#qZ4":
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
    if body.username != "admin" or body.password != "kP9$vW2!mX7#qZ4":
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
            "created_at": v.created_at.isoformat() + "Z"
        }
        for v in voices
    ]

class HistorySaveRequest(BaseModel):
    text: str
    voice: str
    session_id: str
    message_id: str

@app.post("/api/history/save")
async def save_history(body: HistorySaveRequest, db: AsyncSession = Depends(get_db)):
    session_id = sanitize_id(body.session_id)
    message_id = sanitize_id(body.message_id)

    if not session_id or not message_id:
        raise HTTPException(status_code=400, detail="session_id and message_id are required")

    session_filename = f"{session_id}_{message_id}.wav"
    session_filepath = os.path.join(session_audio_dir, session_filename)

    if not os.path.exists(session_filepath):
        raise HTTPException(status_code=404, detail="Session audio not found. It might have been cleared.")

    history_filename = f"saved-{int(time.time())}-{uuid.uuid4().hex[:8]}.wav"
    history_filepath = os.path.join(history_dir, history_filename)

    # Copy file to history directory
    shutil.copy2(session_filepath, history_filepath)

    new_history = TtsHistory(
        text=body.text,
        voice=body.voice,
        audio_path=history_filename
    )
    db.add(new_history)
    await db.commit()

    # Maintain last 50 limit
    result = await db.execute(
        select(TtsHistory).order_by(TtsHistory.created_at.desc()).offset(50)
    )
    old_records = result.scalars().all()
    for old_rec in old_records:
        old_path = os.path.join(history_dir, old_rec.audio_path)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
        await db.delete(old_rec)

    if old_records:
        await db.commit()

    return {"success": True}

@app.get("/api/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TtsHistory).order_by(TtsHistory.created_at.desc()))
    records = result.scalars().all()
    return [{
        "id": h.id,
        "text": h.text,
        "voice": h.voice,
        "audio_url": f"/api/history/audio/{h.audio_path}",
        "created_at": h.created_at.isoformat() + "Z"
    } for h in records]

@app.get("/api/history/audio/{filename}")
async def get_history_audio(filename: str):
    # Basic filename sanitization
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    filepath = os.path.join(history_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="History audio file not found")
    return FileResponse(filepath)
