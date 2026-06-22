# Kokoro TTS Application

This is a local, in-memory Text-to-Speech (TTS) application built using a modern React and FastAPI stack. It leverages `kokoro-onnx` to perform local TTS generation using an ONNX model, avoiding external API calls for voice generation.

## Project Components

- **Frontend (React)**: A single-page application built with React and Vite. It handles the UI for text input, audio playback, and admin settings (like voice blending). It uses Server-Sent Events (SSE) for receiving live audio chunks.
- **Backend (FastAPI)**: A Python web server handling API endpoints using FastAPI.
- **Kokoro TTS Model (`kokoro-onnx`)**: The core TTS engine running inside the Python process using ONNX runtime.
- **Persistent Storage**: Uses the local file system to store the base ONNX models and temporary audio chunks.
- **Database (SQLite)**: Maintains metadata for blended voices, API clients, and performance analytics in a local `.db` file.
- **Analytics Module**: An admin interface utilizing Recharts to monitor and chart TTS generation metrics (e.g., total audio files generated, words processed, average time to first byte) grouped by API client.

*Note: For detailed information, including user flow and component diagrams, please refer to the [architecture.md](architecture.md).*

## Wiki / Documentation

We maintain a detailed technical wiki structured from first principles to help you understand the architecture, data management, and interfaces of Kokoro TTS.

- **[1. Overview](wiki/1-overview.md)**
- **[2. Core Architecture](wiki/2-core-architecture.md)**
  - [2.1 Application Interface](wiki/2.1-application-interface.md)
  - [2.2 Model Execution](wiki/2.2-model-execution.md)
  - [2.3 GPU-Accelerated Architecture](wiki/architecture_gpu_updated.md)
- **[3. User Interfaces](wiki/3-user-interfaces.md)**
  - [3.1 Web Interface](wiki/3.1-web-interface.md)
  - [3.2 Command Line Tools](wiki/3.2-command-line-tools.md)
- **[4. Speech Processing](wiki/4-speech-processing.md)**
  - [4.1 Voice Blending](wiki/4.1-voice-blending.md)
- **[5. Data Management](wiki/5-data-management.md)**
  - [5.1 Analytics and Metrics](wiki/5.1-analytics-and-metrics.md)
- **[6. Development Guide](wiki/6-development-guide.md)**
  - [6.1 Deployment and Setup](wiki/6.1-deployment-and-setup.md)
  - [6.2 Backend API Only](wiki/6.2-backend-api.md)

## Database Interaction

To interact with the SQLite database directly, list tables, and run queries, please see the [Database Interaction Guide](db-interact.md).

## Deployment & Installation

Separate Dockerfiles are provided for the `frontend` and `backend` components.

For comprehensive instructions on how to install, run natively, or deploy using Docker, please refer to the [Installation Guide](install.md). For dedicated Docker setup, please view the [Docker Build Instructions](docker-build.md).

