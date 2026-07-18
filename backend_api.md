# Backend API

The Kokoro TTS backend functions as an API server using FastAPI. This is useful if you want to integrate the Kokoro TTS service into your own applications or run it headlessly.

## Running the Backend

You can run the application directly with Uvicorn:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The console will indicate that it is running on `http://localhost:8000`.

### API Only Mode

If you start the backend with `API_ONLY=true`, then `x-client-id` and `x-client-secret` headers will be required on core endpoints like `/api/tts` and `/api/voices`.

```bash
API_ONLY=true uvicorn main:app --port 8000
```

## Authentication

When `API_ONLY=true` is enabled, core endpoints require authentication headers.

### Generating API Credentials

To generate a new set of credentials, use the `/api/clients` endpoint. This requires admin credentials (default `admin`/`kP9$vW2!mX7#qZ4`, configurable via `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables).

**Endpoint:** `POST /api/clients`

```bash
curl -X POST http://localhost:8000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "kP9$vW2!mX7#qZ4", "clientName": "MyExternalApp"}'
```

## Core API Endpoints

### 1. Generating Text-to-Speech (TTS)

The `/api/tts` endpoint receives text and streams back chunks of generated audio via Server-Sent Events (SSE).

**Endpoint:** `POST /api/tts`
**Content-Type:** `application/json`

**Parameters (JSON Body):**
- `message` (string): The text you want to convert to speech.
- `voice` (string): The voice to use (e.g., `af_heart` or a custom `voiceName`).

#### Example using `curl` (API Only Mode):

```bash
curl -N -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -H "x-client-id: YOUR_CLIENT_ID" \
  -H "x-client-secret: YOUR_CLIENT_SECRET" \
  -d '{"message": "Hello, this is a test.", "voice": "af_heart"}'
```

**Note:** The `-N` or `--no-buffer` flag is important for SSE streams.

### 2. Fetching Available Voices

**Endpoint:** `GET /api/voices`

```bash
curl -X GET http://localhost:8000/api/voices \
  -H "x-client-id: YOUR_CLIENT_ID" \
  -H "x-client-secret: YOUR_CLIENT_SECRET"
```

### 3. Blending Custom Voices

The `/api/blend` endpoint allows you to blend two existing voices to create a new one. This uses admin credentials in the JSON body.

**Endpoint:** `POST /api/blend`
**Content-Type:** `application/json`

#### Example:

```bash
curl -X POST http://localhost:8000/api/blend \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "kP9$vW2!mX7#qZ4", "voiceName": "my_blended_voice", "voiceA": "af_heart", "voiceB": "am_adam", "ratio": 0.5}'
```

### 4. Fetching Analytics Data

Retrieves usage statistics aggregated by API client. Uses admin credentials.

**Endpoint:** `POST /api/analytics`

#### Example:

```bash
curl -X POST http://localhost:8000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "kP9$vW2!mX7#qZ4"}'
```

## Running with Docker (Standalone Backend)

To run only the backend service using Docker:

1. **Build:** `docker build -f backend/Dockerfile.backend -t kokoro-backend ./backend`
2. **Run:**
   ```bash
   docker run -d -p 8000:8000 -e API_ONLY=true -v $(pwd)/data:/app/data kokoro-backend
   ```
