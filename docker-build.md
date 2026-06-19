# Docker Build and Run Instructions

This document provides instructions on how to build and run the Kokoro TTS application using Docker Compose. The architecture has been split into separate `frontend` (React/Vite) and `backend` (Python FastAPI) containers.

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Directory Structure Overview

- `frontend/`: Contains the React SPA and `Dockerfile.frontend`.
- `backend/`: Contains the FastAPI application, ONNX models management, and `Dockerfile.backend`.
- `data/`: Persistent storage mapped to the backend container (for SQLite database and runtime models).
- `docker-compose.yaml`: Orchestrates both containers.

## Building and Running the Application

1. **Initialize Persistent Storage**
   Ensure the `data/models` directory exists locally so it can be properly mounted:
   ```bash
   mkdir -p data/models
   ```

2. **Build and Run the Containers**
   From the root of the repository, execute:
   ```bash
   docker-compose up --build
   ```

   *Note: The backend Docker build process will download the large ONNX model files (`kokoro-v1.0.onnx` and `voices-v1.0.bin`) into the Docker image cache. This ensures the files are only downloaded once during the build process. When the backend container starts, it will copy these files to the persistent `data/models` directory if they don't already exist.*

3. **Access the Application**
   - **Frontend UI:** Open your browser to [http://localhost:3000](http://localhost:3000)
   - **Backend API:** The FastAPI service is running internally on port `8000` and can be accessed at [http://localhost:8000](http://localhost:8000)

4. **Stopping the Containers**
   Press `Ctrl+C` in the terminal where Docker Compose is running, or execute:
   ```bash
   docker-compose down
   ```

## Development and Hot Reloading

- The frontend container uses `npm run dev` and mounts the `./frontend/src` directory, so local changes to the UI code will trigger a hot reload in the browser.
- If you need to make changes to the backend Python code, you will need to restart the backend container or modify the `docker-compose.yaml` to run `uvicorn` with the `--reload` flag and mount the backend directory.

## Running Standalone Backend

For API-only deployments, you can build and run the backend container independently without the frontend.

### 1. Build the Backend Image
From the repository root, run:
```bash
docker build -f backend/Dockerfile.backend -t kokoro-backend ./backend
```

### 2. Run the Backend Container
Start the container with the `API_ONLY=true` environment variable and map the persistent data directory:
```bash
docker run -d \
  --name tts-backend \
  -p 8000:8000 \
  -e API_ONLY=true \
  -v $(pwd)/data:/app/data \
  kokoro-backend
```

This will expose the FastAPI backend at `http://localhost:8000` with authentication enabled.
