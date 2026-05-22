# Backend API Only Mode

You can run the Kokoro TTS application backend purely as an API server, bypassing the frontend completely. This is useful if you want to integrate the Kokoro TTS service into your own applications or run it headlessly.

## Running in API-Only Mode

To run the application in API-only mode, you need to set the `API_ONLY` environment variable to `true` when starting the server.

```bash
# Using npm
API_ONLY=true npm run dev
```

Alternatively, if you're executing `tsx` directly:

```bash
API_ONLY=true npx tsx server.ts
```

The console will indicate that it is running in API Only Mode:
`Server running on http://localhost:3000 (API Only Mode)`

## Core API Endpoints

### 1. Training / Uploading a Custom Voice Sample

The `/api/train` endpoint accepts a single `.wav` file as a sample. It creates voice embeddings which can be used for text-to-speech.

**Endpoint:** `POST /api/train`
**Content-Type:** `multipart/form-data`

**Parameters:**
- `username` (text): Admin username (default: `admin`)
- `password` (text): Admin password (default: `password`)
- `voiceName` (text): The name to assign to this custom voice embedding.
- `sample` (file): The `.wav` or audio sample file.

#### Example using `curl`:

```bash
# Create a dummy test file
echo "dummy audio content" > sample_voice.wav

# Upload the sample voice to create a new embedding named "my_custom_voice"
curl -X POST http://localhost:3000/api/train \
  -H "Accept: application/json" \
  -F "username=admin" \
  -F "password=password" \
  -F "voiceName=my_custom_voice" \
  -F "sample=@sample_voice.wav"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Voice embedding trained successfully",
  "voiceName": "my_custom_voice"
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
curl -N -X POST http://localhost:3000/api/tts \
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

You can then download the generated audio chunk by navigating to `http://localhost:3000/api/audio/chunk-1718884930-0.wav` (the URL provided in the `audioUrl` field).

### 3. Fetching Analytics Data

The `/api/analytics` endpoint provides access to TTS usage statistics (words processed, average time taken) aggregated by API client.

**Endpoint:** `POST /api/analytics`
**Content-Type:** `application/json`

**Parameters (JSON Body):**
- `username` (string): Admin username (default: `admin`)
- `password` (string): Admin password (default: `password`)

#### Example using `curl`:

```bash
curl -X POST http://localhost:3000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

**Expected Response:**

```json
[
  {
    "client_name": "Test Client",
    "total_words_processed": 1500,
    "avg_time_taken_ms": 2540
  }
]
```
