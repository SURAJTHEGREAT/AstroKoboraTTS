# Kokoro TTS Architecture Explorer

This document provides a highly explainable, hierarchical visualization of the Kokoro TTS codebase, following the structural layout and drilling style of modern architectural explorers like [understand-anything.com](https://understand-anything.com).

---

## 🗺️ System Overview (Level 1)

The system is a self-contained, local Text-to-Speech application. It avoids external API calls by running inference directly on the host machine (optimized for CPU/Jetson).

```mermaid
graph TD
    subgraph Client ["Client Layer (Frontend)"]
        FE[React SPA]
    end

    subgraph Server ["Orchestration Layer (Backend)"]
        BE[FastAPI Server]
    end

    subgraph Intelligence ["Inference Layer (Model)"]
        IE[Kokoro ONNX Engine]
    end

    subgraph Data ["Persistence Layer (Storage)"]
        DB[(SQLite Metadata)]
        FS[[File System Assets]]
    end

    FE <-->|REST / SSE| BE
    BE <--> IE
    BE <--> DB
    BE <--> FS

    classDef frontend fill:#e0f2fe,stroke:#0369a1,stroke-width:2px;
    classDef backend fill:#f0fdf4,stroke:#15803d,stroke-width:2px;
    classDef inference fill:#eef2ff,stroke:#4338ca,stroke-width:2px;
    classDef storage fill:#fffbeb,stroke:#b45309,stroke-width:2px;

    class FE frontend;
    class BE backend;
    class IE inference;
    class DB,FS storage;
```

---

## 🔄 Primary Data Flow: Request to Speech

This flow illustrates how a single text prompt traverses the system to become an audible stream.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Frontend (Chat.tsx)
    participant BE as Backend (main.py)
    participant IE as Inference (ONNX)
    participant DB as SQLite

    U->>FE: Input Text
    FE->>BE: POST /api/tts (JSON)
    activate BE
    BE->>BE: chunk_text()
    loop For each chunk
        BE->>IE: generate_audio(text, voice)
        IE-->>BE: raw_samples (NumPy)
        BE->>BE: encode_to_wav()
        BE-->>FE: SSE data: {audioUrl, ramUsage}
        FE->>U: Play Audio Chunk
    end
    BE->>DB: Log Stats (words, ttfb)
    deactivate BE
    FE-->>U: Final Concatenated Audio
```

---

## 🔍 Module Deep Dive (Level 2 & 3)

Click on a subsystem header below to "drill down" into its internal logic and data flow.

<details>
<summary><b>🔵 Subsystem: Frontend (React & Vite)</b></summary>

The frontend is a React-based SPA that manages user interactions, audio playback queues, and real-time metric visualization.

```mermaid
graph LR
    subgraph FE_Modules ["Frontend Modules"]
        App[App.tsx - Router/State]

        subgraph Components
            Chat[Chat.tsx - Real-time TTS]
            Blend[Blending.tsx - Voice Mixing]
            Analytic[Analytics.tsx - Reports]
            Metric[LiveMetrics.tsx - RAM/TTFB]
            History[History.tsx - Saved Audio]
        end

        subgraph Utils
            NG[nameGenerator.ts]
        end
    end

    App --> Chat & Blend & Analytic & Metric & History
    Chat -.->|Uses| NG

    classDef frontend fill:#e0f2fe,stroke:#0369a1,stroke-width:2px;
    class App,Chat,Blend,Analytic,Metric,History,NG frontend;
```

**Component Breakdown:**
*   **App.tsx:** The root orchestrator. It manages the global routing using `react-router` and lifts state for `messages` and `sessionId` so history is preserved when switching tabs.
*   **Chat.tsx:** The primary interaction hub. It handles user input, initiates the SSE connection to `/api/tts`, and manages a complex audio playback queue to ensure seamless streaming.
*   **Blending.tsx:** The admin's creative studio. It provides the UI for selecting two base voices and a sliding ratio to generate new, unique voice embeddings via the `/api/blend` endpoint.
*   **LiveMetrics.tsx:** The performance profiler. It subscribes to the message state and renders high-fidelity Recharts (Bars/Lines) showing RAM consumption and TTFB for every generated chunk.
*   **Analytics.tsx:** The business intelligence view. It aggregates historical data from the backend to show which API clients are most active and their average performance metrics.
*   **History.tsx:** The conversion archive. It allows users to browse and replay the last 50 saved TTS generations, stored locally as `.wav` files.

</details>

<details>
<summary><b>🟢 Subsystem: Backend (FastAPI)</b></summary>

The backend acts as the central orchestrator, handling authentication, data persistence, and model lifecycle.

```mermaid
graph TD
    subgraph BE_Logic ["Backend Logic (main.py)"]
        Start[startup_event] --> Init[Init DB & Load Model]

        subgraph Endpoints
            TTS[/api/tts/]
            BLD[/api/blend/]
            ATC[/api/analytics/]
            HST[/api/history/]
            VCS[/api/voices/]
        end

        subgraph Middleware
            Auth[api_auth_middleware]
            CORS[CORSMiddleware]
        end

        subgraph Helpers
            Chunk[chunk_text]
            Sanitize[sanitize_id]
        end
    end

    Auth --> Endpoints
    TTS --> Chunk
    Endpoints --> Sanitize

    classDef backend fill:#f0fdf4,stroke:#15803d,stroke-width:2px;
    class Start,Init,TTS,BLD,ATC,HST,VCS,Auth,CORS,Chunk,Sanitize backend;
```

**Component Breakdown:**
*   **TTS Endpoint (`/api/tts`):** A POST endpoint that returns a `StreamingResponse`. It coordinates text chunking, model inference, and metadata logging in real-time.
*   **Blend Endpoint (`/api/blend`):** An administrative tool that calculates a new voice embedding vector by interpolating between two existing ones and persists the metadata to SQLite.
*   **Auth Middleware:** A security layer that validates custom headers (`x-client-id`) against the database when the system is deployed in headless/API-only mode.
*   **Helper: `chunk_text`:** A critical performance utility. It splits input text into small bursts to ensure the first audio chunk is delivered to the user as fast as possible (minimizing TTFB).
*   **Startup Logic:** Handles environment discovery, database migration, and pre-loading the heavy ONNX models into memory to avoid latency on the first request.

</details>

<details>
<summary><b>🟣 Subsystem: Inference Engine (Kokoro ONNX)</b></summary>

The intelligence core responsible for turning text into human-like speech.

```mermaid
graph TD
    subgraph IE_Pipeline ["Inference Pipeline"]
        Txt[Input Text] --> Split[Text Splitter]
        Split --> Norm[Normalization]
        Norm --> G2P[Grapheme-to-Phoneme]

        subgraph Core
            Emb[Voice Embedding]
            AM[Acoustic Model - ONNX]
            Voc[Vocoder]
        end

        G2P --> AM
        Emb --> AM
        AM --> Voc
        Voc --> Wav[Audio Samples]
    end

    classDef inference fill:#eef2ff,stroke:#4338ca,stroke-width:2px;
    class Txt,Split,Norm,G2P,Emb,AM,Voc,Wav inference;
```

**Component Breakdown:**
*   **Text Splitter:** Normalizes raw text (handles numbers, punctuation) and prepares it for phonemization.
*   **G2P (Grapheme-to-Phoneme):** Converts written characters into phonemes (the sounds of speech), ensuring accurate pronunciation of complex words.
*   **Acoustic Model (ONNX):** The "brain" of the system. A neural network that maps phonemes and voice embeddings into a latent representation of sound.
*   **Vocoder:** Transforms the model's latent output into a raw audio waveform that humans can hear.
*   **Voice Embeddings:** Pre-computed 512-dimensional vectors that define the unique characteristics (pitch, tone, accent) of a specific speaker.

</details>

<details>
<summary><b>🟠 Subsystem: Persistence (SQLite & Files)</b></summary>

Manages the long-term memory and asset storage of the application.

```mermaid
graph LR
    subgraph Storage_Layer ["Data Management"]
        subgraph DB_Models ["database.py"]
            V[Voice - Custom Embeddings]
            C[ApiClient - Credentials]
            S[ApiClientStat - Analytics]
            H[TtsHistory - Saved Sessions]
        end

        subgraph FS_Paths ["Asset Storage"]
            M[./data/models - ONNX/Bins]
            T[./temp_kokoro_chunks - Cache]
            HA[./data/history_audio - Long term]
        end
    end

    classDef storage fill:#fffbeb,stroke:#b45309,stroke-width:2px;
    class V,C,S,H,M,T,HA storage;
```

**Component Breakdown:**
*   **Voice Table:** Stores the metadata and blending ratios for custom-created speakers.
*   **ApiClient Table:** Manages the registry of external applications authorized to use the TTS engine.
*   **ApiClientStat Table:** A time-series log of every generation, tracking word counts and latency for performance monitoring.
*   **Asset Storage:** A structured directory tree where the static ONNX models live alongside temporary and permanent `.wav` audio artifacts.

</details>
