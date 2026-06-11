# Backend API

The Kokoro TTS backend functions as an API server using FastAPI. This is useful if you want to integrate the Kokoro TTS service into your own applications or run it headlessly.

## Running the Backend

You can run the application directly with Uvicorn:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The console will indicate that it is running on `http://localhost:8000`

If you start the backend with `API_ONLY=true`, then `x-client-id` and `x-client-secret` headers will be required on the `/api/tts` endpoint.

## Core API Endpoints

### 1. Blending Custom Voices

The `/api/blend` endpoint allows you to blend two existing voices to create a new one.

**Endpoint:** `POST /api/blend`
**Content-Type:** `application/json`

**Parameters (JSON Body):**
- `username` (string): Admin username (default: `admin`)
- `password` (string): Admin password (default: `password`)
- `voice_name` (string): The name to assign to this blended voice.
- `voice_a` (string): The first voice to blend.
- `voice_b` (string): The second voice to blend.
- `ratio` (number): The blend ratio (0 to 1).

#### Example using `curl`:

```bash
# Blend voices to create a new embedding named "my_blended_voice"
curl -X POST http://localhost:8000/api/blend \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password", "voice_name": "my_blended_voice", "voice_a": "af_heart", "voice_b": "am_adam", "ratio": 0.5}'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Voice blended successfully",
  "voice_name": "my_blended_voice"
}
```

### 2. Generating Text-to-Speech (TTS)

The `/api/tts` endpoint receives text and streams back chunks of generated audio via Server-Sent Events (SSE).

**Endpoint:** `POST /api/tts`
**Content-Type:** `application/json`

**Parameters (JSON Body):**
- `message` (string): The text you want to convert to speech.
- `voice` (string): The voice to use. You can pass built-in voices (like `af_heart`) or the custom `voiceName` you uploaded previously.

#### Example using `curl`:

Using the newly created `my_custom_voice` embedding:

```bash
curl -N -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, this is a test using my new custom voice.", "voice": "my_custom_voice"}'
```

**Note:** The `-N` or `--no-buffer` flag is important here because the API returns a Server-Sent Events (SSE) stream. You will receive multiple events as the engine processes the text into audio chunks.

**Expected SSE Stream Response:**

```text
data: {"status":"thinking"}

data: {"status":"text","text":"Hello, this is a test using my new custom voice."}

data: {"status":"audio","text":"Hello, ","audioUrl":"/api/audio/chunk-1718884930-0.wav"}

data: {"status":"done"}
```

You can then download the generated audio chunk by navigating to `http://localhost:8000/api/audio/chunk-1718884930-0.wav` (the URL provided in the `audioUrl` field).

### 3. Fetching Analytics Data

The `/api/analytics` endpoint provides access to TTS usage statistics (total files generated, words processed, average time to first byte) aggregated by API client.

**Endpoint:** `POST /api/analytics`
**Content-Type:** `application/json`

**Parameters (JSON Body):**
- `username` (string): Admin username (default: `admin`)
- `password` (string): Admin password (default: `password`)

#### Example using `curl`:

```bash
curl -X POST http://localhost:8000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

**Expected Response:**

```json
[
  {
    "client_name": "Test Client",
    "total_files_generated": 25,
    "total_words_processed": 1500,
    "avg_ttfb_ms": 2540
  }
]
```
