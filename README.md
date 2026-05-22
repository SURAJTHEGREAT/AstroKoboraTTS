# Kokoro TTS Application

This is a local, in-memory Text-to-Speech (TTS) application built using a modern full-stack JavaScript stack. It leverages `kokoro-js` to perform local TTS generation using an ONNX model, avoiding external API calls for voice generation.

## Project Components

- **Frontend (React)**: A single-page application built with React and Vite. It handles the UI for text input, audio playback, and admin settings (like custom voice training). It uses Server-Sent Events (SSE) for receiving live audio chunks.
- **Backend (Express)**: A Node.js web server handling API endpoints and serving static frontend assets.
- **Kokoro TTS Model (`kokoro-js`)**: The core TTS engine running inside the Node.js process using ONNX runtime.
- **Persistent Storage**: Uses the local file system to store voice models (custom voice samples) and temporary audio chunks.
- **Database (SQLite)**: Maintains metadata for trained voices, API clients, and performance analytics in a local `.db` file.
- **Analytics Module**: An admin interface utilizing Recharts to monitor and chart TTS generation metrics (e.g., total audio files generated, words processed, average time to first byte) grouped by API client.

*Note: For detailed information, including user flow and component diagrams, please refer to the [architecture.md](architecture.md).*

## Database Interaction

To interact with the SQLite database directly, list tables, and run queries, please see the [Database Interaction Guide](db-interact.md).

## Deployment & Installation

A `Dockerfile` is available for containerized deployment.

For comprehensive instructions on how to install, run natively, or deploy using Docker, please refer to the [Installation Guide](install.md).

## Testing

Automated tests are written for both the frontend and backend using a suite of tools:
- **Vitest**: The core test runner.
- **@testing-library/react**: For testing React components.
- **supertest**: For testing backend Express API endpoints.

To execute the test suite, run the following command in the project root:

```bash
npm run test
```
