# Installation and Running Guide

This guide provides instructions on how to install and run the Kokoro TTS application on a WSL/Linux environment. You can choose to run it natively using Node.js or in a containerized environment using Docker.

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

## Option 1: Native Execution (Node.js)

1. **Clone the Repository**
   Navigate to your desired workspace and clone the repository.
   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install Dependencies**
   Run the following command to install the required Node.js packages:
   ```bash
   npm install
   ```

3. **Initialize Persistent Storage**
   The application uses a local directory to store databases and models. Ensure the data directory exists (the app will attempt to create it, but it's good practice):
   ```bash
   mkdir -p data/models
   ```

4. **Run the Application**
   Start the application in development mode:
   ```bash
   npm run dev
   ```

5. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`.

---

## Option 2: Docker Execution

Using Docker avoids having to install Node.js natively and ensures a consistent environment.

1. **Clone the Repository**
   Navigate to your desired workspace and clone the repository.
   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Initialize Persistent Storage Directory**
   Docker needs the local directory to mount it as a volume for the database and trained models.
   ```bash
   mkdir -p data/models
   ```

3. **Build and Run the Containers**
   Use Docker Compose to build the image and start the container:
   ```bash
   docker-compose up --build
   ```
   *Note: If you run it in detached mode, append `-d` to the command (`docker-compose up -d --build`).*

4. **Access the Application**
   The application will be exposed on port `3000`. Open your browser and navigate to `http://localhost:3000`.

5. **Stopping the Application**
   If running in the foreground, simply press `Ctrl+C`. If running in detached mode, execute:
   ```bash
   docker-compose down
   ```

## Troubleshooting

- **Port already in use**: If port 3000 is occupied, you might need to stop the conflicting process.
  ```bash
  kill $(lsof -t -i :3000)
  ```
- **File Permissions**: When running Docker on Linux, ensure the user running Docker has read/write permissions to the `./data` directory so SQLite can create/update the `metadata.db` file.
  ```bash
  chmod -R 777 data/
  ```
