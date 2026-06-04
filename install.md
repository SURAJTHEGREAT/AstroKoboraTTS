# Installation and Running Guide

This guide provides instructions on how to install and run the Kokoro TTS application on a WSL/Linux environment. You can choose to run it natively or in a containerized environment using Docker.

## Prerequisites

Regardless of the method you choose, ensure you have the following installed on your system:
- WSL (if on Windows) running a Linux distribution (e.g., Ubuntu).
- A terminal application.

### Native Execution Dependencies
- [Node.js](https://nodejs.org/en/download/) (v18 or higher recommended).
- npm (usually comes with Node.js).

### Docker Execution Dependencies
- [Docker](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/) (often included in Docker Desktop or installable separately on Linux).

---

## Option 1: Native Execution

1. **Clone the Repository**
   Navigate to your desired workspace and clone the repository.
   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Initialize Persistent Storage**
   The application uses a local directory to store databases and models.
   ```bash
   mkdir -p data/models
   ```

3. **Run the Backend (FastAPI)**
   ```bash
   cd backend
   pip install -r requirements.txt
   # Download the ONNX models into data/models
   uvicorn main:app --reload --port 8000
   ```

4. **Run the Frontend (React/Vite)**
   In a new terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`.

---

## Option 2: Docker Execution

Please refer to the [Docker Build Instructions](docker-build.md) for detailed steps on using Docker Compose.


## Troubleshooting

- **Port already in use**: If port 3000 is occupied, you might need to stop the conflicting process.
  ```bash
  kill $(lsof -t -i :3000)
  ```
- **File Permissions**: When running Docker on Linux, ensure the user running Docker has read/write permissions to the `./data` directory so SQLite can create/update the `metadata.db` file.
  ```bash
  chmod -R 777 data/
  ```
