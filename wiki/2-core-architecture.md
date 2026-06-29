# Core Architecture

The Kokoro TTS application follows a full-stack React/FastAPI architecture, segmented into a client-side frontend, a server-side backend, an embedded machine learning inference engine, and persistent storage layers. This modular design ensures that the heavy lifting of speech generation is tightly integrated with the API layer without sacrificing UI responsiveness.

## System Architecture Overview

The system is composed of the following major components:

1. **Frontend (React & Vite)**:
   - A single-page application (SPA) providing the interactive user interface.
   - Handles text input, custom voice upload forms, audio playback, and visualizes analytics using Recharts.
   - Communicates with the backend primarily via REST APIs and Server-Sent Events (SSE) for real-time audio chunk delivery.

2. **Backend (FastAPI)**:
   - Serves as the central orchestrator and API gateway.
   - Exposes RESTful endpoints for TTS generation (`/api/tts`), voice blending (`/api/blend`), and analytics (`/api/analytics`).
   - Can run in an "API-only" mode (`API_ONLY=true`) to bypass static file serving for headless integrations.
   - Interfaces directly with the SQLite database for metadata management and the file system for audio/model storage.

2.5 **Translation Engine (NLLB-200 & CTranslate2)**:
   - Local-first Neural Machine Translation engine.
   - Translates input text between supported languages before it reaches the TTS synthesis stage.
3. **Inference Engine (`kokoro-onnx` & ONNX Runtime)**:
   - Embedded directly within the Python backend process.
   - Executes the pre-trained `Kokoro-82M-v1.0-ONNX` model using the ONNX Runtime for CPU.
   - Responsible for text normalization, grapheme-to-phoneme conversion, spectrogram generation, and final audio synthesis.

4. **Persistent Storage Layer**:
   - **File System**: Stores generated temporary audio chunks (`.wav` files) and uploaded custom voice embeddings (`./data/models`).
   - **Database (SQLite)**: A lightweight `metadata.db` database located in `./data/`. It tracks custom voice metadata, registers API clients, and logs generation statistics (like words processed and Time To First Byte).

## Execution Flow Summary

When a user requests speech generation, the FastAPI backend receives the text and delegates it to the translation engine (if needed) and then the embedded `kokoro-onnx` instance. The ONNX model processes the text and streams the output directly back through the FastAPI server as audio chunks via SSE, while simultaneously logging usage statistics to the SQLite database.
